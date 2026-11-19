import type { ApiSuccess, CoachDashboardDto, FollowUpDto, RiskCode, RiskSettingsDto, UserDashboardDto, UserStatisticsDto } from '@neo/shared-types';
import type { RiskSettingsInput } from '@neo/validation';
import { apiRequest } from '@/services/apiClient';

const data = <T>(r: ApiSuccess<T>): T => r.data;

export const statsApi = {
  userDashboard: () => apiRequest<ApiSuccess<UserDashboardDto>>('/dashboard').then(data),
  coachDashboard: (range: number) => apiRequest<ApiSuccess<CoachDashboardDto>>('/coach/dashboard', { query: { range } }).then(data),
  userStatistics: (userId: string, range: number) =>
    apiRequest<ApiSuccess<UserStatisticsDto>>(`/coach/users/${userId}/statistics`, { query: { range } }).then(data),
  createFollowUp: (userId: string, body: { note: string; reasons: RiskCode[] }) =>
    apiRequest<ApiSuccess<FollowUpDto>>(`/coach/users/${userId}/follow-ups`, { method: 'POST', body }).then(data),
  getRisk: () => apiRequest<ApiSuccess<RiskSettingsDto>>('/coach/settings/risk').then(data),
  updateRisk: (body: RiskSettingsInput) => apiRequest<ApiSuccess<RiskSettingsDto>>('/coach/settings/risk', { method: 'PUT', body }).then(data),
};
