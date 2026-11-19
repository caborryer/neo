import type {
  ApiList,
  ApiSuccess,
  AssignmentDetailDto,
  AssignmentDto,
  FeedbackDto,
  SessionDto,
  SessionHistoryItem,
  WorkoutAssignmentStatus,
  WorkoutCategory,
  WorkoutDifficulty,
  WorkoutDto,
} from '@neo/shared-types';
import type { CreateFeedbackInput } from '@neo/validation';
import { apiRequest } from '@/services/apiClient';

export interface WorkoutFormBody {
  title: string;
  description?: string | null;
  durationMinutes: number;
  difficulty: WorkoutDifficulty;
  category: WorkoutCategory;
  /** Enlace o ID de YouTube; el backend lo normaliza al ID. */
  video: string;
  equipment: string[];
  tips: string[];
  isPublished: boolean;
}

export interface ListWorkoutsParams {
  page: number;
  limit: number;
  search?: string;
  published?: 'true' | 'false';
  category?: WorkoutCategory;
  difficulty?: WorkoutDifficulty;
}

export interface AssignResult {
  created: AssignmentDto[];
  skipped: { userId: string; reason: string }[];
}

export const workoutsApi = {
  list: (params: ListWorkoutsParams) => apiRequest<ApiList<WorkoutDto>>('/workouts', { query: { ...params } }),
  get: (id: string) => apiRequest<ApiSuccess<WorkoutDto>>(`/workouts/${id}`).then((r) => r.data),
  create: (body: WorkoutFormBody) => apiRequest<ApiSuccess<WorkoutDto>>('/coach/workouts', { method: 'POST', body }).then((r) => r.data),
  update: (id: string, body: Partial<WorkoutFormBody>) =>
    apiRequest<ApiSuccess<WorkoutDto>>(`/coach/workouts/${id}`, { method: 'PATCH', body }).then((r) => r.data),
};

export const assignmentsApi = {
  list: (query: { from: string; to: string; userId?: string; status?: WorkoutAssignmentStatus }) =>
    apiRequest<ApiSuccess<AssignmentDto[]>>('/workout-assignments', { query }).then((r) => r.data),
  get: (id: string) => apiRequest<ApiSuccess<AssignmentDetailDto>>(`/workout-assignments/${id}`).then((r) => r.data),
  create: (body: { workoutId: string; userIds: string[]; scheduledDate: string; scheduledTime?: string | null }) =>
    apiRequest<ApiSuccess<AssignResult>>('/coach/workout-assignments', { method: 'POST', body }).then((r) => r.data),
  update: (id: string, body: { scheduledDate?: string; scheduledTime?: string | null; status?: 'CANCELLED' }) =>
    apiRequest<ApiSuccess<AssignmentDto>>(`/coach/workout-assignments/${id}`, { method: 'PATCH', body }).then((r) => r.data),
};

export const sessionsApi = {
  create: (body: { assignmentId: string; idempotencyKey: string; startedAt?: string }) =>
    apiRequest<ApiSuccess<SessionDto>>('/workout-sessions', { method: 'POST', body }).then((r) => r.data),
  history: (page: number, limit = 10) => apiRequest<ApiList<SessionHistoryItem>>('/workout-sessions', { query: { page, limit } }),
  feedback: (sessionId: string, body: CreateFeedbackInput) =>
    apiRequest<ApiSuccess<FeedbackDto>>(`/workout-sessions/${sessionId}/feedback`, { method: 'POST', body }).then((r) => r.data),
};
