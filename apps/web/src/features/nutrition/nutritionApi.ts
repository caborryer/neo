import type {
  ApiList,
  ApiSuccess,
  MealLogDto,
  MealLogStatus,
  MediaAssetDto,
  MyPlanResponse,
  NutritionPlanAssignmentDto,
  NutritionPlanDetailDto,
  NutritionPlanSummaryDto,
  NutritionVersionDto,
} from '@neo/shared-types';
import type {
  CreateMealLogInput,
  CreateNutritionPlanInput,
  NutritionContentInput,
  ReviewMealLogInput,
  UpdateMealLogInput,
  UpdateNutritionPlanInput,
} from '@neo/validation';
import { apiRequest } from '@/services/apiClient';

export interface ListPlansParams {
  page: number;
  limit: number;
  search?: string;
  template?: 'true' | 'false';
  active?: 'true' | 'false';
}

export interface AssignPlanResult {
  created: NutritionPlanAssignmentDto[];
  skipped: { userId: string; reason: string }[];
}

const data = <T>(r: ApiSuccess<T>): T => r.data;

export const plansApi = {
  list: (params: ListPlansParams) => apiRequest<ApiList<NutritionPlanSummaryDto>>('/coach/nutrition-plans', { query: { ...params } }),
  get: (id: string) => apiRequest<ApiSuccess<NutritionPlanDetailDto>>(`/coach/nutrition-plans/${id}`).then(data),
  create: (body: CreateNutritionPlanInput | Record<string, unknown>) =>
    apiRequest<ApiSuccess<NutritionPlanDetailDto>>('/coach/nutrition-plans', { method: 'POST', body }).then(data),
  update: (id: string, body: UpdateNutritionPlanInput) =>
    apiRequest<ApiSuccess<NutritionPlanDetailDto>>(`/coach/nutrition-plans/${id}`, { method: 'PATCH', body }).then(data),
  duplicate: (id: string, body: { name: string; isTemplate: boolean }) =>
    apiRequest<ApiSuccess<NutritionPlanDetailDto>>(`/coach/nutrition-plans/${id}/duplicate`, { method: 'POST', body }).then(data),
  getVersion: (id: string, versionId: string) =>
    apiRequest<ApiSuccess<NutritionVersionDto>>(`/coach/nutrition-plans/${id}/versions/${versionId}`).then(data),
  createVersion: (id: string) => apiRequest<ApiSuccess<NutritionVersionDto>>(`/coach/nutrition-plans/${id}/versions`, { method: 'POST' }).then(data),
  saveDraft: (id: string, versionId: string, body: NutritionContentInput | Record<string, unknown>) =>
    apiRequest<ApiSuccess<NutritionVersionDto>>(`/coach/nutrition-plans/${id}/versions/${versionId}`, { method: 'PUT', body }).then(data),
  publish: (id: string, versionId: string) =>
    apiRequest<ApiSuccess<NutritionVersionDto>>(`/coach/nutrition-plans/${id}/versions/${versionId}/publish`, { method: 'POST' }).then(data),
  assign: (id: string, body: { versionId: string; userIds: string[]; startDate: string; endDate?: string | null }) =>
    apiRequest<ApiSuccess<AssignPlanResult>>(`/coach/nutrition-plans/${id}/assignments`, { method: 'POST', body }).then(data),
  assignments: (id: string) => apiRequest<ApiSuccess<NutritionPlanAssignmentDto[]>>(`/coach/nutrition-plans/${id}/assignments`).then(data),
  forUser: (userId: string) => apiRequest<ApiSuccess<NutritionPlanAssignmentDto[]>>(`/coach/users/${userId}/nutrition-plans`).then(data),
  endAssignment: (assignmentId: string) =>
    apiRequest<ApiSuccess<NutritionPlanAssignmentDto>>(`/coach/nutrition-assignments/${assignmentId}/end`, { method: 'POST' }).then(data),
};

export const myPlanApi = {
  current: (date?: string) => apiRequest<ApiSuccess<MyPlanResponse>>('/nutrition/my-plan', { query: { date } }).then(data),
  history: () => apiRequest<ApiSuccess<NutritionPlanAssignmentDto[]>>('/nutrition/my-plan/history').then(data),
};

export interface ListCoachLogsParams {
  page: number;
  limit: number;
  status?: MealLogStatus;
  userId?: string;
  from?: string;
  to?: string;
}

export const mealLogsApi = {
  listMine: (from: string, to: string) => apiRequest<ApiSuccess<MealLogDto[]>>('/meal-logs', { query: { from, to } }).then(data),
  create: (body: CreateMealLogInput | Record<string, unknown>) => apiRequest<ApiSuccess<MealLogDto>>('/meal-logs', { method: 'POST', body }).then(data),
  update: (id: string, body: UpdateMealLogInput | Record<string, unknown>) =>
    apiRequest<ApiSuccess<MealLogDto>>(`/meal-logs/${id}`, { method: 'PATCH', body }).then(data),
  submit: (id: string) => apiRequest<ApiSuccess<MealLogDto>>(`/meal-logs/${id}/submit`, { method: 'POST' }).then(data),
  remove: (id: string) => apiRequest<void>(`/meal-logs/${id}`, { method: 'DELETE' }),
  listForCoach: (params: ListCoachLogsParams) => apiRequest<ApiList<MealLogDto>>('/coach/meal-logs', { query: { ...params } }),
  review: (id: string, body: ReviewMealLogInput | Record<string, unknown>) =>
    apiRequest<ApiSuccess<MealLogDto>>(`/coach/meal-logs/${id}/review`, { method: 'POST', body }).then(data),
};

export const mediaApi = {
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<ApiSuccess<MediaAssetDto>>('/media/images', { method: 'POST', body: form }).then(data);
  },
};

export const MAX_IMAGE_MB = 5;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
