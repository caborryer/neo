import type { Workout } from '@prisma/client';
import type { AssignmentDetailDto, AssignmentDto, SessionDto, WorkoutDto } from '@neo/shared-types';
import { formatDateOnly } from '../common/dates';

const asStringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

/** Los enums de Prisma y de shared-types comparten valores string. */
export function toWorkoutDto(w: Workout): WorkoutDto {
  return {
    id: w.id,
    title: w.title,
    description: w.description,
    durationMinutes: w.durationMinutes,
    difficulty: w.difficulty as WorkoutDto['difficulty'],
    category: w.category as WorkoutDto['category'],
    videoId: w.videoId,
    videoVisibility: w.videoVisibility as WorkoutDto['videoVisibility'],
    equipment: asStringList(w.equipment),
    tips: asStringList(w.tips),
    isPublished: w.isPublished,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

interface SessionRow {
  id: string;
  assignmentId: string;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
  completionPercentage: number | null;
  durationMinutes: number | null;
  feedback?: { id: string } | null;
}

export function toSessionDto(s: SessionRow): SessionDto {
  return {
    id: s.id,
    assignmentId: s.assignmentId,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    status: s.status as SessionDto['status'],
    completionPercentage: s.completionPercentage,
    durationMinutes: s.durationMinutes,
    hasFeedback: !!s.feedback,
  };
}

interface AssignmentRow {
  id: string;
  scheduledDate: Date;
  scheduledTime: string | null;
  status: string;
  workout: Workout;
  user: { id: string; firstName: string; lastName: string };
  sessions: SessionRow[];
}

const base = (a: AssignmentRow) => ({
  id: a.id,
  scheduledDate: formatDateOnly(a.scheduledDate),
  scheduledTime: a.scheduledTime,
  status: a.status as AssignmentDto['status'],
  user: { id: a.user.id, firstName: a.user.firstName, lastName: a.user.lastName },
  session: a.sessions[0] ? toSessionDto(a.sessions[0]) : null,
});

export function toAssignmentDto(a: AssignmentRow): AssignmentDto {
  const w = toWorkoutDto(a.workout);
  return {
    ...base(a),
    workout: {
      id: w.id,
      title: w.title,
      durationMinutes: w.durationMinutes,
      difficulty: w.difficulty,
      category: w.category,
      videoId: w.videoId,
      isPublished: w.isPublished,
    },
  };
}

export const toAssignmentDetailDto = (a: AssignmentRow): AssignmentDetailDto => ({ ...base(a), workout: toWorkoutDto(a.workout) });

export const assignmentInclude = {
  workout: true,
  user: { select: { id: true, firstName: true, lastName: true } },
  // Una sesión por asignación en el MVP (S3); se trae la más reciente.
  sessions: { orderBy: { createdAt: 'desc' as const }, take: 1, include: { feedback: { select: { id: true } } } },
};
