import type { ApiList, ApiSuccess, NotificationDto } from '@neo/shared-types';
import { apiRequest } from '@/services/apiClient';

export const notificationsApi = {
  list: (page: number, unread: boolean, limit = 20) =>
    apiRequest<ApiList<NotificationDto>>('/notifications', { query: { page, limit, unread: unread ? 'true' : undefined } }),
  unreadCount: () => apiRequest<ApiSuccess<{ count: number }>>('/notifications/unread-count').then((r) => r.data.count),
  markRead: (id: string) => apiRequest<ApiSuccess<NotificationDto>>(`/notifications/${id}/read`, { method: 'POST' }).then((r) => r.data),
  markAllRead: () => apiRequest<ApiSuccess<{ updated: number }>>('/notifications/read-all', { method: 'POST' }).then((r) => r.data),
};

/** Cada 60 s mientras la pestaña está visible: no hay push en el MVP. */
export const UNREAD_POLL_MS = 60_000;
