import type { Content } from '@prisma/client';
import type { ContentDto } from '@neo/shared-types';
import { mediaUrl } from '../storage/media.service';

export function toContentDto(c: Content): ContentDto {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category as ContentDto['category'],
    type: c.type as ContentDto['type'],
    body: c.body,
    videoId: c.videoId,
    thumbnailUrl: c.thumbnailAssetId ? mediaUrl(c.thumbnailAssetId) : null,
    thumbnailAssetId: c.thumbnailAssetId,
    published: c.published,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
