import { NotFoundException } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { addDays, todayIn } from '../common/dates';

const TZ = 'America/Bogota';
const TODAY = todayIn(TZ);
const d = (ago: number) => new Date(`${addDays(TODAY, -ago)}T00:00:00Z`);
const cfg = { inactivityDays: 7, consecutiveMissed: 3, noFoodLogDays: 5, adherenceDropPoints: 25 };
const coach: any = { id: 'c1', timezone: TZ, role: 'COACH' };

function setup(over: Record<string, any> = {}) {
  const prisma: any = {
    user: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), findUnique: jest.fn() },
    workoutAssignment: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
    mealLog: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
    nutritionPlanAssignment: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    riskFollowUp: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    notification: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
    ...over,
  };
  const settings: any = { getRisk: jest.fn().mockResolvedValue(cfg) };
  const audit: any = { record: jest.fn() };
  return { service: new StatisticsService(prisma, settings, audit), prisma, audit };
}
const user = (id: string, over: object = {}) => ({ id, firstName: id, lastName: 'X', timezone: TZ, weeklyGoal: 3, activatedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), ...over });

describe('StatisticsService.coachDashboard (HU-14)', () => {
  it('sin usuarias devuelve ceros y sin porcentaje (no 0 %)', async () => {
    const { service } = setup();
    const res = await service.coachDashboard(coach, 30);
    expect(res).toMatchObject({ activeUsers: 0, goalsMet: 0, atRisk: [], atRiskTotal: 0, nutrition: { usersWithPlan: 0, usersWithoutPlan: 0 } });
    expect(res.workouts.adherence).toBeNull();
  });

  it('solo considera usuarias activas y excluye entrenamientos cancelados', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([user('u1')]);
    await service.coachDashboard(coach, 30);
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ role: 'USER', status: 'ACTIVE' });
    expect(prisma.workoutAssignment.findMany.mock.calls[0][0].where.status).toEqual({ not: 'CANCELLED' });
  });

  it('calcula adherencia, metas cumplidas y plan/sin plan', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([user('u1', { weeklyGoal: 1 }), user('u2')]);
    prisma.workoutAssignment.findMany.mockImplementation(async (args: any) =>
      args.where.scheduledDate.gte
        ? [
            { userId: 'u1', scheduledDate: d(0), status: 'COMPLETED' },
            { userId: 'u2', scheduledDate: d(1), status: 'SKIPPED' },
          ]
        : [],
    );
    prisma.nutritionPlanAssignment.findMany.mockImplementation(async (args: any) => (args.select.startDate ? [] : [{ userId: 'u1' }]));
    prisma.mealLog.count.mockResolvedValueOnce(3).mockResolvedValueOnce(8);
    const res = await service.coachDashboard(coach, 7);
    expect(res.workouts).toMatchObject({ scheduled: 2, completed: 1, skipped: 1, adherence: 50 });
    expect(res.chart).toHaveLength(7);
    expect(res.chart.at(-1)).toMatchObject({ date: TODAY, completed: 1, adherence: 100 });
    expect(res.nutrition).toEqual({ pendingReview: 3, submitted: 8, usersWithPlan: 1, usersWithoutPlan: 1 });
  });

  it('el gráfico es semanal en 30 y 90 días', async () => {
    const { service } = setup();
    expect((await service.coachDashboard(coach, 30)).chart).toHaveLength(5);
    expect((await service.coachDashboard(coach, 90)).chart).toHaveLength(13);
  });

  it('lista en riesgo a quien no ha entrenado y ordena por cantidad de motivos', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([user('ok'), user('riesgo')]);
    prisma.workoutAssignment.findMany.mockImplementation(async (args: any) => {
      if (args.where.scheduledDate.gte && !args.where.scheduledDate.lte) {
        return [
          { userId: 'ok', scheduledDate: d(1), status: 'COMPLETED' },
          { userId: 'riesgo', scheduledDate: d(12), status: 'COMPLETED' },
          { userId: 'riesgo', scheduledDate: d(3), status: 'SKIPPED' },
          { userId: 'riesgo', scheduledDate: d(2), status: 'SKIPPED' },
          { userId: 'riesgo', scheduledDate: d(1), status: 'SKIPPED' },
        ];
      }
      return [];
    });
    prisma.riskFollowUp.groupBy.mockResolvedValue([{ userId: 'riesgo', _max: { createdAt: new Date('2026-11-10T00:00:00Z') } }]);
    const res = await service.coachDashboard(coach, 30);
    expect(res.atRiskTotal).toBe(1);
    expect(res.atRisk[0]).toMatchObject({ userId: 'riesgo', lastFollowUpAt: '2026-11-10T00:00:00.000Z' });
    expect(res.atRisk[0]!.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(['INACTIVITY', 'CONSECUTIVE_MISSED']));
  });

  it('limita la lista a 10 pero informa el total', async () => {
    const { service, prisma } = setup();
    const many = Array.from({ length: 12 }, (_, i) => user(`u${i}`));
    prisma.user.findMany.mockResolvedValue(many);
    prisma.workoutAssignment.findMany.mockImplementation(async (args: any) =>
      args.where.scheduledDate.gte && !args.where.scheduledDate.lte ? many.flatMap((u) => [d(12), d(3), d(2), d(1)].map((x, i) => ({ userId: u.id, scheduledDate: x, status: i === 0 ? 'COMPLETED' : 'SKIPPED' }))) : [],
    );
    const res = await service.coachDashboard(coach, 30);
    expect(res.atRisk).toHaveLength(10);
    expect(res.atRiskTotal).toBe(12);
  });
});

describe('StatisticsService.userStatistics (HU-08, HU-26)', () => {
  it('usuaria inexistente o que no es usuaria → 404', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.userStatistics('x', 30)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({ id: 'x', role: 'USER' });
  });

  it('devuelve adherencia del rango, meta semanal, último entrenamiento, plan y seguimientos', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue(user('u1'));
    prisma.workoutAssignment.findMany.mockResolvedValue([
      { scheduledDate: d(2), status: 'COMPLETED' },
      { scheduledDate: d(4), status: 'COMPLETED' },
      { scheduledDate: d(5), status: 'PARTIAL' },
      { scheduledDate: d(6), status: 'SKIPPED' },
      { scheduledDate: d(60), status: 'SKIPPED' },
    ]);
    prisma.nutritionPlanAssignment.findFirst.mockResolvedValue({ startDate: d(10), endDate: null, version: { plan: { name: 'Definición' } } });
    prisma.mealLog.count.mockResolvedValue(2);
    prisma.riskFollowUp.findMany.mockResolvedValue([{ id: 'f1', note: 'Le escribí', reasons: ['INACTIVITY'], createdAt: new Date('2026-11-01T00:00:00Z'), coach: { firstName: 'Cata', lastName: 'L' } }]);
    const res = await service.userStatistics('u1', 7);
    expect(res.adherence).toMatchObject({ scheduled: 4, completed: 2, partial: 1, skipped: 1, adherence: 50 });
    expect(res.lastWorkoutDate).toBe(addDays(TODAY, -2));
    expect(res.currentPlan).toMatchObject({ planName: 'Definición', endDate: null });
    expect(res.pendingReviews).toBe(2);
    expect(res.followUps[0]).toMatchObject({ coachName: 'Cata L', reasons: ['INACTIVITY'] });
  });
});

describe('StatisticsService.createFollowUp (HU-27)', () => {
  it('registra la acción de la Coach y audita sin guardar el texto en el log', async () => {
    const { service, prisma, audit } = setup();
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    prisma.riskFollowUp.create.mockResolvedValue({ id: 'f1', note: 'Llamada', reasons: ['NO_FOOD_LOGS'], createdAt: new Date('2026-11-18T00:00:00Z'), coach: { firstName: 'C', lastName: 'L' } });
    const res = await service.createFollowUp('c1', 'u1', { note: 'Llamada', reasons: ['NO_FOOD_LOGS'] });
    expect(prisma.riskFollowUp.create.mock.calls[0][0].data).toEqual({ userId: 'u1', coachId: 'c1', note: 'Llamada', reasons: ['NO_FOOD_LOGS'] });
    expect(res).toMatchObject({ id: 'f1', coachName: 'C L' });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('Llamada');
  });

  it('usuaria inexistente → 404 y no crea nada', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.createFollowUp('c1', 'x', { note: 'abc', reasons: [] })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.riskFollowUp.create).not.toHaveBeenCalled();
  });
});

describe('StatisticsService.userDashboard (HU-16)', () => {
  const me: any = { id: 'u1', firstName: 'Ana', timezone: TZ, role: 'USER' };

  it('consulta solo datos de la propia usuaria', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ weeklyGoal: 4 });
    await service.userDashboard(me);
    for (const m of [prisma.workoutAssignment.findMany, prisma.workoutAssignment.findFirst, prisma.nutritionPlanAssignment.findFirst, prisma.mealLog.count, prisma.notification.count]) {
      expect(m.mock.calls[0][0].where.userId).toBe('u1');
    }
  });

  it('meta semanal, hoy hecho, comidas del plan de hoy y no leídas', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ weeklyGoal: 4 });
    prisma.workoutAssignment.findMany.mockResolvedValue([{ scheduledDate: d(0), status: 'COMPLETED' }, { scheduledDate: d(0), status: 'PARTIAL' }]);
    const dayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date(`${TODAY}T00:00:00Z`).getUTCDay()];
    prisma.nutritionPlanAssignment.findFirst.mockResolvedValue({ version: { plan: { name: 'Plan A' }, days: [{ dayName, _count: { meals: 4 } }, { dayName: 'OTHER', _count: { meals: 9 } }] } });
    prisma.mealLog.count.mockResolvedValue(2);
    prisma.notification.count.mockResolvedValue(5);
    const res = await service.userDashboard(me);
    expect(res).toMatchObject({
      firstName: 'Ana',
      weekly: { completed: 1, goal: 4 },
      todayDone: true,
      next: null,
      nutrition: { planName: 'Plan A', plannedMealsToday: 4, loggedToday: 2 },
      unreadNotifications: 5,
    });
  });

  it('sin plan ni entrenamientos devuelve valores vacíos y la meta por defecto', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await service.userDashboard(me);
    expect(res).toMatchObject({ weekly: { completed: 0, goal: 3 }, todayDone: false, nutrition: { planName: null, plannedMealsToday: 0, loggedToday: 0 } });
  });
});
