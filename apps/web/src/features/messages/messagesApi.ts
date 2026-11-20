import type { ApiSuccess, ConversationDto, MessageDto, MessageListDto, ThreadInfoDto } from '@neo/shared-types';
import { apiRequest } from '@/services/apiClient';

const data = <T>(r: ApiSuccess<T>): T => r.data;
const page = (before?: string) => ({ query: { before, limit: 30 } });

export interface ThreadApi {
  /** Clave base de TanStack Query del hilo. */
  key: readonly unknown[];
  info: () => Promise<ThreadInfoDto>;
  list: (before?: string) => Promise<MessageListDto>;
  send: (body: string) => Promise<MessageDto>;
  markRead: () => Promise<unknown>;
}

export const userThread: ThreadApi = {
  key: ['messages', 'me'],
  info: () => apiRequest<ApiSuccess<ThreadInfoDto>>('/messages/thread').then(data),
  list: (before) => apiRequest<MessageListDto>('/messages', page(before)),
  send: (body) => apiRequest<ApiSuccess<MessageDto>>('/messages', { method: 'POST', body: { body } }).then(data),
  markRead: () => apiRequest<ApiSuccess<{ updated: number }>>('/messages/read', { method: 'POST' }),
};

export const coachThread = (userId: string): ThreadApi => ({
  key: ['messages', 'coach', userId],
  info: () => apiRequest<ApiSuccess<ThreadInfoDto>>(`/coach/conversations/${userId}/thread`).then(data),
  list: (before) => apiRequest<MessageListDto>(`/coach/conversations/${userId}/messages`, page(before)),
  send: (body) => apiRequest<ApiSuccess<MessageDto>>(`/coach/conversations/${userId}/messages`, { method: 'POST', body: { body } }).then(data),
  markRead: () => apiRequest<ApiSuccess<{ updated: number }>>(`/coach/conversations/${userId}/read`, { method: 'POST' }),
});

export const messagesApi = {
  unreadCount: () => apiRequest<ApiSuccess<{ count: number }>>('/messages/unread-count').then((r) => r.data.count),
  conversations: (search: string) =>
    apiRequest<ApiSuccess<ConversationDto[]>>('/coach/conversations', { query: { search: search || undefined } }).then(data),
};

/** Sin websockets: consulta periódica mientras el hilo está abierto (y la pestaña visible). */
export const THREAD_POLL_MS = 15_000;
export const BADGE_POLL_MS = 60_000;
