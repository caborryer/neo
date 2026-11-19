import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';

const KEY_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

/**
 * Almacenamiento de archivos en disco local (desarrollo y primer despliegue).
 * La interfaz (save/open/remove con una `storageKey` opaca) es la misma que tendría un
 * driver S3, de modo que cambiarlo no toca a quienes la usan. §9.2 pide S3 privado en producción.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('STORAGE_DIR') ?? './storage');
  }

  /** Guarda el archivo con un nombre aleatorio (nunca el del cliente) y devuelve la clave. */
  async save(buffer: Buffer, extension: string): Promise<string> {
    const key = `${randomUUID()}.${extension}`;
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, key), buffer, { flag: 'wx' });
    return key;
  }

  open(key: string): ReadStream {
    return createReadStream(this.pathFor(key));
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.pathFor(key));
    } catch (err) {
      this.logger.warn(`No se pudo borrar ${key}: ${(err as Error).message}`);
    }
  }

  /** La clave se valida estrictamente: así no hay forma de salir del directorio (path traversal). */
  private pathFor(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error('Clave de almacenamiento inválida');
    return join(this.root, key);
  }
}
