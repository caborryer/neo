import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { ApiList, ContentDto } from '@neo/shared-types';
import { contentCompletenessIssue, type CreateContentInput, type ListContentQuery, type UpdateContentInput } from '@neo/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { toContentDto } from './content.mapper';

type Db = Prisma.TransactionClient;

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** La miniatura debe ser una imagen subida por la propia Coach. */
  private async assertThumbnail(db: Db, assetId: string | null | undefined, ownerId: string) {
    if (!assetId) return;
    const asset = await db.mediaAsset.findFirst({ where: { id: assetId, ownerId }, select: { id: true } });
    if (!asset) throw new BadRequestException('La imagen no existe o no es tuya');
  }

  async create(actorId: string, input: CreateContentInput): Promise<ContentDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertThumbnail(tx, input.thumbnailAssetId, actorId);
      const isVideo = input.type === 'VIDEO';
      const content = await tx.content.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          category: input.category,
          type: input.type,
          // Un artículo no guarda video y un video no guarda cuerpo de artículo.
          body: isVideo ? null : (input.body ?? null),
          videoId: isVideo ? (input.video ?? null) : null,
          thumbnailAssetId: input.thumbnailAssetId ?? null,
          published: input.published,
          createdById: actorId,
        },
      });
      await this.audit.record({ actorId, action: 'CONTENT_CREATED', resource: 'Content', resourceId: content.id }, tx);
      return toContentDto(content);
    });
  }

  async update(actorId: string, id: string, input: UpdateContentInput): Promise<ContentDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.content.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Contenido no encontrado');
      if (input.thumbnailAssetId !== undefined) await this.assertThumbnail(tx, input.thumbnailAssetId, actorId);

      const type = input.type ?? (current.type as 'ARTICLE' | 'VIDEO');
      const body = input.body !== undefined ? input.body : current.body;
      const video = input.video !== undefined ? input.video : current.videoId;
      const issue = contentCompletenessIssue({ type: type as never, body, video });
      if (issue) throw new BadRequestException(issue.message);

      const { video: _video, ...rest } = input;
      const data: Prisma.ContentUncheckedUpdateInput = {
        ...rest,
        type,
        body: type === 'VIDEO' ? null : body,
        videoId: type === 'VIDEO' ? video : null,
      };
      const updated = await tx.content.update({ where: { id }, data });
      const action =
        input.published !== undefined && input.published !== current.published
          ? input.published
            ? 'CONTENT_PUBLISHED'
            : 'CONTENT_UNPUBLISHED'
          : 'CONTENT_UPDATED';
      await this.audit.record({ actorId, action, resource: 'Content', resourceId: id, metadata: { fields: Object.keys(input) } }, tx);
      return toContentDto(updated);
    });
  }

  async remove(actorId: string, id: string): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.content.findUnique({ where: { id }, select: { id: true, title: true } });
      if (!current) throw new NotFoundException('Contenido no encontrado');
      await tx.content.delete({ where: { id } });
      await this.audit.record({ actorId, action: 'CONTENT_DELETED', resource: 'Content', resourceId: id, metadata: { title: current.title } }, tx);
      return { id };
    });
  }

  /** La Coach ve todo (también borradores); la usuaria solo lo publicado. */
  async list(user: AuthenticatedUser, query: ListContentQuery): Promise<ApiList<ContentDto>> {
    const where: Prisma.ContentWhereInput = {};
    if (user.role === UserRole.USER) where.published = true;
    else if (query.published) where.published = query.published === 'true';
    if (query.category) where.category = query.category;
    if (query.type) where.type = query.type;
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.content.count({ where }),
      this.prisma.content.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map(toContentDto),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  }

  async get(user: AuthenticatedUser, id: string): Promise<ContentDto> {
    const where: Prisma.ContentWhereInput = { id };
    if (user.role === UserRole.USER) where.published = true;
    const content = await this.prisma.content.findFirst({ where });
    // 404 también si es un borrador y quien consulta es una usuaria (RNF-19).
    if (!content) throw new NotFoundException('Contenido no encontrado');
    return toContentDto(content);
  }
}
