import type { ApiSuccess, FoodScheduleDto, MealType } from '@neo/shared-types';
import { apiRequest } from '@/services/apiClient';

export const schedulesApi = {
  list: () => apiRequest<ApiSuccess<FoodScheduleDto[]>>('/food-schedules').then((r) => r.data),
  save: (mealType: MealType, body: { scheduledTime: string; reminderEnabled: boolean }) =>
    apiRequest<ApiSuccess<FoodScheduleDto>>(`/food-schedules/${mealType}`, { method: 'PUT', body }).then((r) => r.data),
};
