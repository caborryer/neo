import { BadRequestException, ForbiddenException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import type { MediaAssetDto } from '@neo/shared-types';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { detectImageMime, extensionFor } from './image-type';
import { InvalidImageError, sanitizeImage } from './image-sanitizer';
import { StorageService } from './storage.service';

export interface UploadedImage {
  buffer: Buffer;
  originalname: string;
  size: number;
}

export const mediaUrl = (id: string): string => `/api/v1/media/${id}`;

@Injectable()
export class MediaService {
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.maxBytes = (config.get<number>('MAX_UPLOAD_MB') ?? 5) * 1024 * 1024;
  }

  /** Valida el contenido real del archivo, lo guarda con nombre aleatorio y registra el MediaAsset (§9.2). */
  async uploadImage(owner: AuthenticatedUser, file: UploadedImage | undefined): Promise<MediaAssetDto> {
    // HU-28: las usuarias aceptan primero la política de privacidad y el uso de fotos.
    if (owner.role === UserRole.USER && !owner.privacyConsentAt) {
      throw new ForbiddenException('Acepta la política de privacidad para subir fotos');
    }
    if (!file || file.size === 0) throw new BadRequestException('Adjunta una imagen');
    if (file.size > this.maxBytes) {
      throw new BadRequestException(`La imagen supera el máximo de ${Math.round(this.maxBytes / 1024 / 1024)} MB`);
    }
    const mime = detectImageMime(file.buffer);
    if (!mime) throw new BadRequestException('Formato no permitido. Usa JPG, PNG o WebP');

    // Se guarda la versión re-codificada (sin EXIF/GPS, con dimensiones acotadas), nunca los bytes originales.
    let clean: Buffer;
    try {
      clean = await sanitizeImage(file.buffer, mime);
    } catch (err) {
      if (err instanceof InvalidImageError) throw new BadRequestException(err.message);
      throw err;
    }

    const storageKey = await this.storage.save(clean, extensionFor(mime));
    try {
      const asset = await this.prisma.mediaAsset.create({
        data: {
          ownerId: owner.id,
          fileName: file.originalname.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'imagen',
          mimeType: mime,
          storageKey,
          sizeBytes: clean.length,
        },
      });
      return { id: asset.id, url: mediaUrl(asset.id), mimeType: asset.mimeType, sizeBytes: asset.sizeBytes };
    } catch (err) {
      await this.storage.remove(storageKey); // no dejar archivos huérfanos si falla el registro
      throw err;
    }
  }

  /**
   * Una usuaria solo accede a sus propias imágenes; la Coach, a las de sus usuarias (RNF-19).
   * Para el resto responde 404, igual que si no existiera.
   */
  async open(user: AuthenticatedUser, id: string): Promise<{ file: StreamableFile; mimeType: string }> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Archivo no encontrado');
    if (user.role !== UserRole.COACH && asset.ownerId !== user.id) {
      // Excepción: la miniatura de un contenido publicado es visible para todas las usuarias (HU-33).
      const published = await this.prisma.content.findFirst({ where: { thumbnailAssetId: id, published: true }, select: { id: true } });
      if (!published) throw new NotFoundException('Archivo no encontrado');
    }
    return { file: new StreamableFile(this.storage.open(asset.storageKey)), mimeType: asset.mimeType };
  }
}
