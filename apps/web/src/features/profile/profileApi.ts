import type { ApiSuccess, AuthUser } from '@neo/shared-types';
import type { ChangePasswordInput, UpdateProfileInput } from '@neo/validation';
import { apiRequest } from '@/services/apiClient';

export const profileApi = {
  update: (body: UpdateProfileInput) => apiRequest<ApiSuccess<AuthUser>>('/users/me', { method: 'PATCH', body }).then((r) => r.data),
  acceptPrivacy: () => apiRequest<ApiSuccess<AuthUser>>('/users/me/privacy-consent', { method: 'POST' }).then((r) => r.data),
  changePassword: (body: ChangePasswordInput) =>
    apiRequest<ApiSuccess<{ message: string }>>('/auth/change-password', { method: 'POST', body }).then((r) => r.data),
};
