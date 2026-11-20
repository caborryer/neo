import type { AdherenceBucketDto, AdvancedStatsDto, TopWorkoutDto, UserStatsRowDto, WeeklyStatsPointDto } from '@neo/shared-types';
import { addDays, diffDays, weekStartOf } from '../common/dates';
import { computeAdherence, mergeAdherence, type AssignmentFact } from './adherence';

export interface AdvancedAssignment extends AssignmentFact {
  userId: string;
  workoutId: string;
  workoutTitle: string;
}
export interface AdvancedMealLog {
  userId: string;
  /** Fecha local (YYYY-MM-DD) en la zona de la Coach. */
  date: string;
  consumedAt: Date;
  reviewedAt: Date | null;
}
export interface AdvancedFeedback {
  userId: string;
  feelingRating: number;
}
export interface AdvancedUser {
  id: string;
  name: string;
}

export interface AdvancedInput {
  from: string;
  to: string;
  today: string;
  users: AdvancedUser[];
  assignments: AdvancedAssignment[];
  mealLogs: AdvancedMealLog[];
  feedback: AdvancedFeedback[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (values: number[]): number | null => (values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null);

/** Semanas (lunes) que cubre el período, de la primera a la última. */
export function weekStarts(from: string, to: string): string[] {
  const out: string[] = [];
  for (let w = weekStartOf(from); w <= to; w = addDays(w, 7)) out.push(w);
  return out;
}

/** Cubetas de adherencia por usuaria; las que no tuvieron entrenamientos válidos van aparte. */
export function bucketAdherence(values: Array<number | null>): AdherenceBucketDto[] {
  const buckets: AdherenceBucketDto[] = [
    { label: '90–100%', users: 0 },
    { label: '70–89%', users: 0 },
    { label: '50–69%', users: 0 },
    { label: 'Menos de 50%', users: 0 },
    { label: 'Sin datos', users: 0 },
  ];
  for (const v of values) {
    const i = v === null ? 4 : v >= 90 ? 0 : v >= 70 ? 1 : v >= 50 ? 2 : 3;
    buckets[i]!.users++;
  }
  return buckets;
}

/**
 * HU-31: métricas agregadas del período [from, to] (ya recortado a hoy). Función pura para poder probarla sin base de datos.
 * Las semanas parciales en los extremos se promedian con los días reales del período (mínimo 1 semana equivalente).
 */
export function computeAdvancedStats(input: AdvancedInput): AdvancedStatsDto {
  const { from, to, today, users, assignments, mealLogs, feedback } = input;
  const days = diffDays(from, to) + 1;
  const weeksEquivalent = Math.max(days / 7, 1);

  const byUser = new Map<string, AdvancedAssignment[]>();
  for (const a of assignments) {
    if (a.status === 'CANCELLED') continue;
    const list = byUser.get(a.userId) ?? [];
    list.push(a);
    byUser.set(a.userId, list);
  }
  const mealsByUser = new Map<string, number>();
  for (const m of mealLogs) mealsByUser.set(m.userId, (mealsByUser.get(m.userId) ?? 0) + 1);
  const feelingByUser = new Map<string, number[]>();
  for (const f of feedback) feelingByUser.set(f.userId, [...(feelingByUser.get(f.userId) ?? []), f.feelingRating]);

  const rows: UserStatsRowDto[] = users.map((u) => {
    const mine = byUser.get(u.id) ?? [];
    const adh = computeAdherence(mine, today);
    const lastWorkoutDate = mine.filter((a) => a.status === 'COMPLETED').map((a) => a.scheduledDate).sort().pop() ?? null;
    return {
      userId: u.id,
      userName: u.name,
      scheduled: adh.scheduled,
      completed: adh.completed,
      partial: adh.partial,
      adherence: adh.adherence,
      sessionsPerWeek: round1(adh.completed / weeksEquivalent),
      mealLogs: mealsByUser.get(u.id) ?? 0,
      avgFeeling: avg(feelingByUser.get(u.id) ?? []),
      lastWorkoutDate,
    };
  });
  rows.sort((a, b) => (a.adherence ?? -1) - (b.adherence ?? -1) || a.userName.localeCompare(b.userName, 'es'));

  const valid = assignments.filter((a) => a.status !== 'CANCELLED');
  const total = mergeAdherence(users.map((u) => computeAdherence(byUser.get(u.id) ?? [], today)));

  const weekly: WeeklyStatsPointDto[] = weekStarts(from, to).map((weekStart) => {
    const end = addDays(weekStart, 6);
    const adh = computeAdherence(valid.filter((a) => a.scheduledDate >= weekStart && a.scheduledDate <= end), today);
    return {
      weekStart,
      scheduled: adh.scheduled,
      completed: adh.completed,
      adherence: adh.adherence,
      mealLogs: mealLogs.filter((m) => m.date >= weekStart && m.date <= end).length,
    };
  });

  const workouts = new Map<string, { title: string; rows: AdvancedAssignment[] }>();
  for (const a of valid) {
    const w = workouts.get(a.workoutId) ?? { title: a.workoutTitle, rows: [] };
    w.rows.push(a);
    workouts.set(a.workoutId, w);
  }
  const topWorkouts: TopWorkoutDto[] = [...workouts.entries()]
    .map(([workoutId, w]) => {
      const adh = computeAdherence(w.rows, today);
      return { workoutId, title: w.title, scheduled: adh.scheduled, completed: adh.completed, adherence: adh.adherence };
    })
    .filter((w) => w.scheduled > 0)
    .sort((a, b) => b.completed - a.completed || b.scheduled - a.scheduled || a.title.localeCompare(b.title, 'es'))
    .slice(0, 5);

  const reviewed = mealLogs.filter((m) => m.reviewedAt);
  const reviewHours = reviewed.map((m) => Math.max(0, (m.reviewedAt!.getTime() - m.consumedAt.getTime()) / 3_600_000));

  return {
    from,
    to,
    days,
    activeUsers: users.length,
    workouts: total,
    avgSessionsPerUserWeek: users.length ? round1(total.completed / users.length / weeksEquivalent) : null,
    mealLogs: mealLogs.length,
    mealLogsPerWeek: users.length ? round1(mealLogs.length / weeksEquivalent) : null,
    avgFeeling: avg(feedback.map((f) => f.feelingRating)),
    feedbackCount: feedback.length,
    avgReviewHours: avg(reviewHours),
    weekly,
    distribution: bucketAdherence(rows.map((r) => r.adherence)),
    users: rows,
    topWorkouts,
  };
}
