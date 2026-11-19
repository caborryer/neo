import type { ApiList, ApiSuccess, UserStatus } from '@neo/shared-types';
import type { CreateUserInput, UpdateUserInput } from '@neo/validation';
import { apiRequest } from '@/services/apiClient';

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: UserStatus;
  timezone: string;
  weeklyGoal: number;
  accessExpiresAt: string | null;
  activatedAt: string | null;
  createdAt: string;
}

export interface AccessEvent {
  id: string;
  previousStatus: UserStatus | null;
  newStatus: UserStatus;
  reason: string | null;
  changedBy: string;
  createdAt: string;
}

export interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  status?: UserStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ChangeAccessBody {
  status: UserStatus;
  reason?: string;
  /** ISO; null quita el vencimiento; ausente lo deja igual. */
  accessExpiresAt?: string | null;
}

export const usersApi = {
  list: (params: ListUsersParams) => apiRequest<ApiList<UserSummary>>('/coach/users', { query: { ...params } }),
  get: (id: string) => apiRequest<ApiSuccess<UserSummary>>(`/coach/users/${id}`).then((r) => r.data),
  create: (input: Omit<CreateUserInput, 'accessExpiresAt'> & { accessExpiresAt?: string }) =>
    apiRequest<ApiSuccess<UserSummary & { invitationSent: boolean }>>('/coach/users', { method: 'POST', body: input }).then((r) => r.data),
  update: (id: string, input: UpdateUserInput) =>
    apiRequest<ApiSuccess<UserSummary>>(`/coach/users/${id}`, { method: 'PATCH', body: input }).then((r) => r.data),
  resendInvitation: (id: string) =>
    apiRequest<ApiSuccess<{ invitationSent: boolean }>>(`/coach/users/${id}/resend-invitation`, { method: 'POST' }).then((r) => r.data),
  changeAccess: (id: string, body: ChangeAccessBody) =>
    apiRequest<ApiSuccess<unknown>>(`/coach/users/${id}/access`, { method: 'PATCH', body }).then((r) => r.data),
  accessHistory: (id: string, page: number, limit = 10) =>
    apiRequest<ApiList<AccessEvent>>(`/coach/users/${id}/access-history`, { query: { page, limit } }),
};
