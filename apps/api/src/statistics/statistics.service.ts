import { Injectable, NotFoundException } from '@nestjs/common';
import { MealLogStatus, UserRole, UserStatus, WorkoutAssignmentStatus } from '@prisma/client';
import type {
  AtRiskUserDto,
  ChartPointDto,
  CoachDashboardDto,
  FollowUpDto,
  RiskCode,
  RiskReasonDto,
  UserDashboardDto,
  UserStatisticsDto,
} from '@neo/shared-types';
import type { CreateFollowUpInput, RiskSettingsInput } from '@neo/validation';
import { AuditService } from '../audit/audit.service';
import { addDays, dayOfWeekName, formatDateOnly, parseDateOnly, todayIn, weekStartOf, zonedTimeToUtc } from '../common/dates';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { assignmentInclude, toAssignmentDto } from '../workouts/workout.mapper';
import { computeAdherence, type AssignmentFact } from './adherence';
import { evaluateRisk } from './risk';
import { SettingsService } from './settings.service';

/** Ventana de datos que necesitan las reglas de riesgo (4 semanas + margen). */
const RISK_WINDOW_DAYS = 35;
const AT_RISK_LIMIT = 10;

const fact = (a: { scheduledDate: Date; status: string }): AssignmentFact => ({ scheduledDate: formatDateOnly(a.scheduledDate), status: a.status });

@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ── Coach: dashboard (HU-14) ──────────────────────────────────────────

  async coachDashboard(coach: AuthenticatedUser, rangeDays: number): Promise<CoachDashboardDto> {
    const today = todayIn(coach.timezone);
    const rangeStart = addDays(today, -(rangeDays - 1));
    const weekStart = weekStartOf(today);
    const cfg = await this.settings.getRisk();

    const users = await this.prisma.user.findMany({
      where: { role: UserRole.USER, status: UserStatus.ACTIVE },
      select: { id: true, firstName: true, lastName: true, timezone: true, weeklyGoal: true, activatedAt: true, createdAt: true },
    });
    const ids = users.map((u) => u.id);

    const [assignments, upcomingWeek, pendingReview, submitted, activePlans] = await Promise.all([
      this.prisma.workoutAssignment.findMany({
        where: { userId: { in: ids }, scheduledDate: { gte: parseDateOnly(rangeStart), lte: parseDateOnly(today) }, status: { not: WorkoutAssignmentStatus.CANCELLED } },
        select: { userId: true, scheduledDate: true, status: true },
      }),
      this.prisma.workoutAssignment.count({
        where: { userId: { in: ids }, status: WorkoutAssignmentStatus.SCHEDULED, scheduledDate: { gte: parseDateOnly(today), lte: parseDateOnly(addDays(today, 7)) } },
      }),
      this.prisma.mealLog.count({ where: { userId: { in: ids }, status: MealLogStatus.SUBMITTED } }),
      this.prisma.mealLog.count({
        where: { userId: { in: ids }, status: { not: MealLogStatus.DRAFT }, consumedAt: { gte: zonedTimeToUtc(rangeStart, '00:00', coach.timezone) } },
      }),
      this.prisma.nutritionPlanAssignment.findMany({
        where: { userId: { in: ids }, status: 'ACTIVE', startDate: { lte: parseDateOnly(today) }, OR: [{ endDate: null }, { endDate: { gte: parseDateOnly(today) } }] },
        select: { userId: true },
      }),
    ]);

    const facts = assignments.map((a) => ({ userId: a.userId, ...fact(a) }));
    const goalsMet = users.filter((u) => {
      const done = facts.filter((f) => f.userId === u.id && f.scheduledDate >= weekStart && f.status === WorkoutAssignmentStatus.COMPLETED).length;
      return done >= u.weeklyGoal;
    }).length;
    const withPlan = new Set(activePlans.map((p) => p.userId)).size;

    const atRiskAll = await this.atRiskUsers(users, cfg);
    return {
      rangeDays,
      activeUsers: users.length,
      goalsMet,
      workouts: computeAdherence(facts, today),
      upcomingWeek,
      chart: this.chart(facts, today, rangeDays),
      nutrition: { pendingReview, submitted, usersWithPlan: withPlan, usersWithoutPlan: users.length - withPlan },
      atRisk: atRiskAll.slice(0, AT_RISK_LIMIT),
      atRiskTotal: atRiskAll.length,
    };
  }

  /** Por día en 7 días y por semana en 30 o 90 (mantiene el gráfico legible). */
  private chart(facts: AssignmentFact[], today: string, rangeDays: number): ChartPointDto[] {
    const step = rangeDays <= 7 ? 1 : 7;
    const points: ChartPointDto[] = [];
    for (let start = addDays(today, -(rangeDays - 1)); start <= today; start = addDays(start, step)) {
      const end = addDays(start, step - 1);
      const a = computeAdherence(facts.filter((f) => f.scheduledDate >= start && f.scheduledDate <= end), today);
      points.push({ label: start.slice(5), date: start, scheduled: a.scheduled, completed: a.completed, adherence: a.adherence });
    }
    return points;
  }

  /** Evalúa el riesgo de varias usuarias con pocas consultas (no una por usuaria). */
  private async atRiskUsers(
    users: { id: string; firstName: string; lastName: string; timezone: string; activatedAt: Date | null; createdAt: Date }[],
    cfg: RiskSettingsInput,
  ): Promise<AtRiskUserDto[]> {
    if (users.length === 0) return [];
    const ids = users.map((u) => u.id);
    const since = new Date(Date.now() - (RISK_WINDOW_DAYS + 1) * 86_400_000);
    const [assignments, plans, lastLogs, lastFollowUps] = await Promise.all([
      this.prisma.workoutAssignment.findMany({
        where: { userId: { in: ids }, status: { not: WorkoutAssignmentStatus.CANCELLED }, scheduledDate: { gte: since } },
        select: { userId: true, scheduledDate: true, status: true },
      }),
      this.prisma.nutritionPlanAssignment.findMany({
        where: { userId: { in: ids }, status: 'ACTIVE', startDate: { lte: new Date() }, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
        select: { userId: true, startDate: true },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.mealLog.groupBy({ by: ['userId'], where: { userId: { in: ids }, status: { not: MealLogStatus.DRAFT } }, _max: { consumedAt: true } }),
      this.prisma.riskFollowUp.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _max: { createdAt: true } }),
    ]);

    const out: AtRiskUserDto[] = [];
    for (const u of users) {
      const reasons = evaluateRisk(
        {
          today: todayIn(u.timezone),
          activeSince: formatDateOnly(u.activatedAt ?? u.createdAt),
          assignments: assignments.filter((a) => a.userId === u.id).map(fact),
          activePlanStart: this.planStart(plans, u.id),
          lastMealLogDate: this.lastLogDate(lastLogs, u.id, u.timezone),
        },
        cfg,
      );
      if (reasons.length === 0) continue;
      const fu = lastFollowUps.find((f) => f.userId === u.id)?._max.createdAt ?? null;
      out.push({ userId: u.id, userName: `${u.firstName} ${u.lastName}`.trim(), reasons, lastFollowUpAt: fu ? fu.toISOString() : null });
    }
    return out.sort((a, b) => b.reasons.length - a.reasons.length || a.userName.localeCompare(b.userName));
  }

  private planStart(plans: { userId: string; startDate: Date }[], userId: string): string | null {
    const p = plans.find((x) => x.userId === userId);
    return p ? formatDateOnly(p.startDate) : null;
  }

  private lastLogDate(rows: { userId: string; _max: { consumedAt: Date | null } }[], userId: string, tz: string): string | null {
    const d = rows.find((r) => r.userId === userId)?._max.consumedAt;
    return d ? todayIn(tz, d) : null;
  }

  // ── Coach: vista 360 de una usuaria (HU-08, HU-26, HU-27) ─────────────

  async userStatistics(userId: string, rangeDays: number): Promise<UserStatisticsDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.USER },
      select: { id: true, firstName: true, lastName: true, timezone: true, weeklyGoal: true, status: true, activatedAt: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Usuaria no encontrada');
    const today = todayIn(user.timezone);
    const rangeStart = addDays(today, -(rangeDays - 1));
    const weekStart = weekStartOf(today);
    const cfg = await this.settings.getRisk();

    const [rows, plan, pendingReviews, followUps, atRisk] = await Promise.all([
      this.prisma.workoutAssignment.findMany({
        where: { userId, status: { not: WorkoutAssignmentStatus.CANCELLED }, scheduledDate: { gte: parseDateOnly(addDays(today, -RISK_WINDOW_DAYS)), lte: parseDateOnly(addDays(today, 30)) } },
        select: { scheduledDate: true, status: true },
      }),
      this.prisma.nutritionPlanAssignment.findFirst({
        where: { userId, status: 'ACTIVE', startDate: { lte: parseDateOnly(today) }, OR: [{ endDate: null }, { endDate: { gte: parseDateOnly(today) } }] },
        orderBy: { startDate: 'desc' },
        include: { version: { select: { plan: { select: { name: true } } } } },
      }),
      this.prisma.mealLog.count({ where: { userId, status: MealLogStatus.SUBMITTED } }),
      this.listFollowUps(userId),
      this.atRiskUsers([user], cfg),
    ]);

    const facts = rows.map(fact);
    const inRange = facts.filter((f) => f.scheduledDate >= rangeStart && f.scheduledDate <= today);
    const lastDone = facts.filter((f) => ['COMPLETED', 'PARTIAL'].includes(f.status) && f.scheduledDate <= today).map((f) => f.scheduledDate).sort().at(-1) ?? null;
    return {
      rangeDays,
      adherence: computeAdherence(inRange, today),
      weekly: { completed: facts.filter((f) => f.status === 'COMPLETED' && f.scheduledDate >= weekStart && f.scheduledDate <= today).length, goal: user.weeklyGoal },
      lastWorkoutDate: lastDone,
      risk: (atRisk[0]?.reasons ?? []) as RiskReasonDto[],
      followUps,
      currentPlan: plan && { planName: plan.version.plan.name, startDate: formatDateOnly(plan.startDate), endDate: plan.endDate ? formatDateOnly(plan.endDate) : null },
      pendingReviews,
    };
  }

  async listFollowUps(userId: string): Promise<FollowUpDto[]> {
    const rows = await this.prisma.riskFollowUp.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { coach: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      note: r.note,
      reasons: r.reasons as RiskCode[],
      coachName: `${r.coach.firstName} ${r.coach.lastName}`.trim(),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** HU-27: la Coach deja constancia de qué hizo frente a una alerta. */
  async createFollowUp(coachId: string, userId: string, input: CreateFollowUpInput): Promise<FollowUpDto> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, role: UserRole.USER }, select: { id: true } });
    if (!user) throw new NotFoundException('Usuaria no encontrada');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.riskFollowUp.create({
        data: { userId, coachId, note: input.note, reasons: input.reasons },
        include: { coach: { select: { firstName: true, lastName: true } } },
      });
      await this.audit.record({ actorId: coachId, action: 'RISK_FOLLOW_UP_CREATED', resource: 'User', resourceId: userId, metadata: { reasons: input.reasons } }, tx);
      return {
        id: row.id,
        note: row.note,
        reasons: row.reasons as RiskCode[],
        coachName: `${row.coach.firstName} ${row.coach.lastName}`.trim(),
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  // ── Usuaria: dashboard (HU-16) ────────────────────────────────────────

  async userDashboard(user: AuthenticatedUser): Promise<UserDashboardDto> {
    const today = todayIn(user.timezone);
    const weekStart = weekStartOf(today);
    const dayStart = zonedTimeToUtc(today, '00:00', user.timezone);
    const dayEnd = zonedTimeToUtc(addDays(today, 1), '00:00', user.timezone);

    const [me, done, next, plan, loggedToday, unread] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id }, select: { weeklyGoal: true } }),
      this.prisma.workoutAssignment.findMany({
        where: { userId: user.id, status: { in: [WorkoutAssignmentStatus.COMPLETED, WorkoutAssignmentStatus.PARTIAL] }, scheduledDate: { gte: parseDateOnly(weekStart), lte: parseDateOnly(today) } },
        select: { scheduledDate: true, status: true },
      }),
      this.prisma.workoutAssignment.findFirst({
        where: { userId: user.id, status: { in: [WorkoutAssignmentStatus.SCHEDULED, WorkoutAssignmentStatus.IN_PROGRESS] }, scheduledDate: { gte: parseDateOnly(today) } },
        orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: { sort: 'asc', nulls: 'last' } }],
        include: assignmentInclude,
      }),
      this.prisma.nutritionPlanAssignment.findFirst({
        where: { userId: user.id, status: 'ACTIVE', startDate: { lte: parseDateOnly(today) }, OR: [{ endDate: null }, { endDate: { gte: parseDateOnly(today) } }] },
        orderBy: { startDate: 'desc' },
        include: { version: { select: { plan: { select: { name: true } }, days: { select: { dayName: true, _count: { select: { meals: true } } } } } } },
      }),
      this.prisma.mealLog.count({ where: { userId: user.id, consumedAt: { gte: dayStart, lt: dayEnd } } }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    const todayName = dayOfWeekName(today);
    const planned = plan?.version.days.find((d) => d.dayName === todayName)?._count.meals ?? 0;
    return {
      firstName: user.firstName,
      weekly: { completed: done.filter((d) => d.status === WorkoutAssignmentStatus.COMPLETED).length, goal: me?.weeklyGoal ?? 3 },
      next: next ? toAssignmentDto(next) : null,
      todayDone: done.some((d) => formatDateOnly(d.scheduledDate) === today),
      nutrition: { planName: plan?.version.plan.name ?? null, plannedMealsToday: planned, loggedToday },
      unreadNotifications: unread,
    };
  }
}
