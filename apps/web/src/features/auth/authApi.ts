import type { ApiSuccess, AuthUser } from '@neo/shared-types';
import type { ForgotPasswordInput, LoginInput } from '@neo/validation';
import { apiRequest } from '@/services/apiClient';

export const authApi = {
  login: (input: LoginInput) => apiRequest<ApiSuccess<AuthUser>>('/auth/login', { method: 'POST', body: input }).then((r) => r.data),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  me: () => apiRequest<ApiSuccess<AuthUser>>('/users/me').then((r) => r.data),
  forgotPassword: (input: ForgotPasswordInput) =>
    apiRequest<ApiSuccess<{ message: string }>>('/auth/forgot-password', { method: 'POST', body: input }).then((r) => r.data),
  resetPassword: (input: { token: string; password: string; confirmPassword: string }) =>
    apiRequest<ApiSuccess<{ message: string }>>('/auth/reset-password', { method: 'POST', body: input }).then((r) => r.data),
};
