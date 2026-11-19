import type { ApiList, ApiSuccess, ChallengeDetailDto, ChallengeDto, ChallengeProgressDto } from '@neo/shared-types';
import { apiRequest } from '@/services/apiClient';

export interface ChallengeFormBody {
  name: string;
  description: string | null;
  category: string;
  goal: number;
  startDate: string;
  endDate: string;
  published: boolean;
}

export interface ListChallengesParams {
  page: number;
  limit: number;
  search?: string;
  published?: 'true' | 'false';
}

const data = <T,>(r: ApiSuccess<T>) => r.data;

export const coachChallengesApi = {
  list: (params: ListChallengesParams) => apiRequest<ApiList<ChallengeDto>>('/coach/challenges', { query: { ...params } }),
  get: (id: string) => apiRequest<ApiSuccess<ChallengeDetailDto>>(`/coach/challenges/${id}`).then(data),
  create: (body: ChallengeFormBody) => apiRequest<ApiSuccess<ChallengeDto>>('/coach/challenges', { method: 'POST', body }).then(data),
  update: (id: string, body: Partial<ChallengeFormBody>) =>
    apiRequest<ApiSuccess<ChallengeDto>>(`/coach/challenges/${id}`, { method: 'PATCH', body }).then(data),
};

export const challengesApi = {
  list: (params: Omit<ListChallengesParams, 'published'>) => apiRequest<ApiList<ChallengeDto>>('/challenges', { query: { ...params } }),
  get: (id: string) => apiRequest<ApiSuccess<ChallengeDto>>(`/challenges/${id}`).then(data),
  join: (id: string) => apiRequest<ApiSuccess<ChallengeDto>>(`/challenges/${id}/join`, { method: 'POST' }).then(data),
  leave: (id: string) => apiRequest<ApiSuccess<ChallengeDto>>(`/challenges/${id}/leave`, { method: 'POST' }).then(data),
  progress: (id: string) => apiRequest<ApiSuccess<ChallengeProgressDto>>(`/challenges/${id}/progress`).then(data),
};
