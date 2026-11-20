import { bucketAdherence, computeAdvancedStats, weekStarts, type AdvancedAssignment } from './advanced';

const TODAY = '2026-11-18'; // miércoles
const a = (userId: string, date: string, status: string, workoutId = 'w1', title = 'Fuerza'): AdvancedAssignment => ({ userId, scheduledDate: date, status, workoutId, workoutTitle: title });
const users = [{ id: 'u1', name: 'Ana Pérez' }, { id: 'u2', name: 'Bea Gómez' }, { id: 'u3', name: 'Cami Ruiz' }];

describe('weekStarts', () => {
  it('lista los lunes que cubre el período', () => {
    expect(weekStarts('2026-11-04', '2026-11-18')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
  });
});

describe('bucketAdherence', () => {
  it('reparte por tramos y separa las usuarias sin datos', () => {
    const b = bucketAdherence([100, 90, 75, 50, 49, 0, null]);
    expect(b.map((x) => x.users)).toEqual([2, 1, 1, 2, 1]);
  });
});

describe('computeAdvancedStats (HU-31)', () => {
  const base = {
    from: '2026-11-02',
    to: TODAY,
    today: TODAY,
    users,
    assignments: [
      a('u1', '2026-11-02', 'COMPLETED'),
      a('u1', '2026-11-04', 'COMPLETED'),
      a('u1', '2026-11-10', 'COMPLETED', 'w2', 'Cardio'),
      a('u1', '2026-11-12', 'PARTIAL'),
      a('u2', '2026-11-03', 'SKIPPED'),
      a('u2', '2026-11-11', 'SCHEDULED'), // vencida sin hacer → no completada
      a('u2', '2026-11-17', 'COMPLETED'),
      a('u2', '2026-11-18', 'SCHEDULED'), // hoy: aún no cuenta
      a('u1', '2026-11-05', 'CANCELLED'),
    ],
    mealLogs: [
      { userId: 'u1', date: '2026-11-03', consumedAt: new Date('2026-11-03T13:00:00Z'), reviewedAt: new Date('2026-11-03T15:00:00Z') },
      { userId: 'u1', date: '2026-11-10', consumedAt: new Date('2026-11-10T13:00:00Z'), reviewedAt: new Date('2026-11-10T19:00:00Z') },
      { userId: 'u2', date: '2026-11-17', consumedAt: new Date('2026-11-17T13:00:00Z'), reviewedAt: null },
    ],
    feedback: [
      { userId: 'u1', feelingRating: 5 },
      { userId: 'u1', feelingRating: 4 },
      { userId: 'u2', feelingRating: 2 },
    ],
  };
  const res = computeAdvancedStats(base);

  it('calcula KPIs globales ignorando cancelados y lo que aún no llega', () => {
    expect(res.days).toBe(17);
    expect(res.activeUsers).toBe(3);
    expect(res.workouts).toMatchObject({ scheduled: 7, completed: 4, partial: 1, skipped: 1, missed: 1, upcoming: 1, adherence: 57 });
    expect(res.mealLogs).toBe(3);
    expect(res.avgFeeling).toBe(3.7);
    expect(res.feedbackCount).toBe(3);
  });

  it('promedia el tiempo de revisión solo con las comidas revisadas', () => {
    expect(res.avgReviewHours).toBe(4); // (2h + 6h) / 2
  });

  it('agrupa por semanas con adherencia y registros de comida', () => {
    expect(res.weekly.map((w) => w.weekStart)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(res.weekly[0]).toMatchObject({ scheduled: 3, completed: 2, adherence: 67, mealLogs: 1 });
    expect(res.weekly[1]).toMatchObject({ scheduled: 3, completed: 1, mealLogs: 1 });
    expect(res.weekly[2]).toMatchObject({ scheduled: 1, completed: 1, adherence: 100, mealLogs: 1 });
  });

  it('arma la tabla por usuaria, ordenada de menor a mayor adherencia y con "sin datos" primero', () => {
    expect(res.users.map((u) => u.userName)).toEqual(['Cami Ruiz', 'Bea Gómez', 'Ana Pérez']);
    const ana = res.users.find((u) => u.userId === 'u1')!;
    expect(ana).toMatchObject({ scheduled: 4, completed: 3, partial: 1, adherence: 75, mealLogs: 2, avgFeeling: 4.5, lastWorkoutDate: '2026-11-10' });
    expect(res.users.find((u) => u.userId === 'u3')).toMatchObject({ scheduled: 0, adherence: null, avgFeeling: null, lastWorkoutDate: null });
  });

  it('distribuye usuarias por tramo de adherencia', () => {
    expect(res.distribution.map((d) => d.users)).toEqual([0, 1, 0, 1, 1]);
  });

  it('lista los entrenamientos más completados', () => {
    expect(res.topWorkouts[0]).toMatchObject({ workoutId: 'w1', title: 'Fuerza', completed: 3 });
    expect(res.topWorkouts).toHaveLength(2);
  });

  it('sin usuarias activas devuelve ceros y nulos sin dividir por cero', () => {
    const empty = computeAdvancedStats({ ...base, users: [], assignments: [], mealLogs: [], feedback: [] });
    expect(empty).toMatchObject({ activeUsers: 0, avgSessionsPerUserWeek: null, mealLogsPerWeek: null, avgFeeling: null, avgReviewHours: null });
    expect(empty.workouts.adherence).toBeNull();
    expect(empty.users).toEqual([]);
  });
});
