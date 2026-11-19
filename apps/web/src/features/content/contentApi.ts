import type { ApiList, ApiSuccess, ContentCategory, ContentDto, ContentType } from '@neo/shared-types';
import { apiRequest } from '@/services/apiClient';

export interface ContentFormBody {
  title: string;
  description: string | null;
  category: ContentCategory;
  type: ContentType;
  body: string | null;
  /** Enlace o ID de YouTube; el backend lo normaliza al ID. */
  video: string | null;
  thumbnailAssetId: string | null;
  published: boolean;
}

export interface ListContentParams {
  page: number;
  limit: number;
  search?: string;
  published?: 'true' | 'false';
  category?: ContentCategory;
  type?: ContentType;
}

export const contentApi = {
  list: (params: ListContentParams) => apiRequest<ApiList<ContentDto>>('/content', { query: { ...params } }),
  get: (id: string) => apiRequest<ApiSuccess<ContentDto>>(`/content/${id}`).then((r) => r.data),
  create: (body: ContentFormBody) => apiRequest<ApiSuccess<ContentDto>>('/coach/content', { method: 'POST', body }).then((r) => r.data),
  update: (id: string, body: Partial<ContentFormBody>) =>
    apiRequest<ApiSuccess<ContentDto>>(`/coach/content/${id}`, { method: 'PATCH', body }).then((r) => r.data),
  remove: (id: string) => apiRequest<void>(`/coach/content/${id}`, { method: 'DELETE' }),
};
