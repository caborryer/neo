import type {
  FeedbackCompletion,
  VideoVisibility,
  WorkoutAssignmentStatus,
  WorkoutCategory,
  WorkoutDifficulty,
} from './enums';

/** Clase tal como la ve la Coach. Fuente: docs/ESPECIFICACION.md §7.5. */
export interface WorkoutDto {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  difficulty: WorkoutDifficulty;
  category: WorkoutCategory;
  videoId: string;
  videoVisibility: VideoVisibility;
  equipment: string[];
  tips: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDto {
  id: string;
  assignmentId: string;
  startedAt: string;
  completedAt: string | null;
  status: WorkoutAssignmentStatus;
  completionPercentage: number | null;
  durationMinutes: number | null;
  hasFeedback: boolean;
}

/** Asignación con la clase y (para la Coach) la usuaria. scheduledDate es YYYY-MM-DD. */
export interface AssignmentDto {
  id: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: WorkoutAssignmentStatus;
  workout: Pick<WorkoutDto, 'id' | 'title' | 'durationMinutes' | 'difficulty' | 'category' | 'videoId' | 'isPublished'>;
  user: { id: string; firstName: string; lastName: string };
  session: SessionDto | null;
}

export interface AssignmentDetailDto extends Omit<AssignmentDto, 'workout'> {
  workout: WorkoutDto;
}

export interface FeedbackDto {
  id: string;
  sessionId: string;
  completed: FeedbackCompletion;
  completionPercentage: number | null;
  notCompletedReason: string | null;
  feelingRating: number;
  feelingDescription: string | null;
  ateBeforeWorkout: boolean;
  preWorkoutMeal: string | null;
  createdAt: string;
}

/** Fila del historial de sesiones (GET /workout-sessions). */
export interface SessionHistoryItem extends SessionDto {
  workoutTitle: string;
  scheduledDate: string;
  user: { id: string; firstName: string; lastName: string };
}
