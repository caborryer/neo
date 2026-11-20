import type { MealType, NotificationType } from './enums';
import type { AssignmentDto } from './workout';

/** Dashboards, adherencia y notificaciones. Fuente: docs/ESPECIFICACION.md §4.7 a §4.9. */

/**
 * Adherencia = completados / programados válidos (§4.7). Válidos = completados + parciales + omitidos + vencidos sin hacer;
 * no cuentan los cancelados ni los que aún no llegan. Los parciales se informan aparte.
 */
export interface AdherenceDto {
  scheduled: number;
  completed: number;
  partial: number;
  skipped: number;
  /** Fecha ya pasada y sin completar (la usuaria no llegó a registrar nada). */
  missed: number;
  /** Aún por venir (hoy o futuro): no entra en el cálculo. */
  upcoming: number;
  adherence: number | null;
  partialRate: number | null;
}

export type RiskCode = 'INACTIVITY' | 'CONSECUTIVE_MISSED' | 'NO_FOOD_LOGS' | 'ADHERENCE_DROP';

export interface RiskReasonDto {
  code: RiskCode;
  message: string;
}

export interface AtRiskUserDto {
  userId: string;
  userName: string;
  reasons: RiskReasonDto[];
  lastFollowUpAt: string | null;
}

/** Umbrales configurables de las alertas (§4.8, HU-15). */
export interface RiskSettingsDto {
  inactivityDays: number;
  consecutiveMissed: number;
  noFoodLogDays: number;
  adherenceDropPoints: number;
}

export interface ChartPointDto {
  label: string;
  date: string;
  scheduled: number;
  completed: number;
  adherence: number | null;
}

export interface CoachDashboardDto {
  rangeDays: number;
  activeUsers: number;
  /** Usuarias que ya cumplieron su meta semanal (lunes a hoy). */
  goalsMet: number;
  workouts: AdherenceDto;
  /** Entrenamientos programados para hoy y los próximos 7 días. */
  upcomingWeek: number;
  chart: ChartPointDto[];
  nutrition: { pendingReview: number; submitted: number; usersWithPlan: number; usersWithoutPlan: number };
  atRisk: AtRiskUserDto[];
  atRiskTotal: number;
}

export interface FollowUpDto {
  id: string;
  note: string;
  reasons: RiskCode[];
  coachName: string;
  createdAt: string;
}

export interface UserStatisticsDto {
  rangeDays: number;
  adherence: AdherenceDto;
  weekly: { completed: number; goal: number };
  lastWorkoutDate: string | null;
  risk: RiskReasonDto[];
  followUps: FollowUpDto[];
  currentPlan: { planName: string; startDate: string; endDate: string | null } | null;
  pendingReviews: number;
}

export interface UserDashboardDto {
  firstName: string;
  weekly: { completed: number; goal: number };
  /** Próximo entrenamiento programado (hoy o más adelante). */
  next: AssignmentDto | null;
  /** Ya completó o registró algo hoy. */
  todayDone: boolean;
  nutrition: { planName: string | null; plannedMealsToday: number; loggedToday: number };
  unreadNotifications: number;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface FoodScheduleDto {
  mealType: MealType;
  scheduledTime: string;
  reminderEnabled: boolean;
  /** true = aún no la configuró: es la hora sugerida por defecto. */
  isDefault: boolean;
}

// ─── Fase 7: estadísticas avanzadas (HU-31 · C05) ───────────────────────

export interface WeeklyStatsPointDto {
  /** Lunes de la semana (YYYY-MM-DD). */
  weekStart: string;
  scheduled: number;
  completed: number;
  adherence: number | null;
  mealLogs: number;
}

export interface AdherenceBucketDto {
  label: string;
  users: number;
}

export interface UserStatsRowDto {
  userId: string;
  userName: string;
  scheduled: number;
  completed: number;
  partial: number;
  adherence: number | null;
  /** Sesiones completadas por semana (promedio en el período). */
  sessionsPerWeek: number;
  mealLogs: number;
  /** Sensación promedio (1–5) declarada en el feedback; null si no hay feedback. */
  avgFeeling: number | null;
  lastWorkoutDate: string | null;
}

export interface TopWorkoutDto {
  workoutId: string;
  title: string;
  scheduled: number;
  completed: number;
  adherence: number | null;
}

export interface AdvancedStatsDto {
  from: string;
  to: string;
  days: number;
  activeUsers: number;
  workouts: AdherenceDto;
  avgSessionsPerUserWeek: number | null;
  mealLogs: number;
  mealLogsPerWeek: number | null;
  avgFeeling: number | null;
  feedbackCount: number;
  /** Horas promedio entre el registro de una comida y su revisión; null si no hay revisadas. */
  avgReviewHours: number | null;
  weekly: WeeklyStatsPointDto[];
  distribution: AdherenceBucketDto[];
  users: UserStatsRowDto[];
  topWorkouts: TopWorkoutDto[];
}
