import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SessionsService } from './sessions.service';

const KEY = '22222222-2222-4222-8222-222222222222';
const user: any = { id: 'u1', role: 'USER', timezone: 'America/Bogota' };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const sessionRow = (over: object = {}) => ({ id: 's1', assignmentId: 'a1', startedAt: new Date(), completedAt: new Date(), status: 'COMPLETED', completionPercentage: 100, durationMinutes: 55, feedback: null, ...over });

function setup() {
  const tx: any = {
    workoutAssignment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
    workoutSession: { create: jest.fn().mockImplementation(async ({ data }: any) => sessionRow(data)), update: jest.fn() },
    workoutFeedback: { create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'f1', createdAt: new Date(), ...data })) },
  };
  const prisma: any = {
    workoutSession: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    workoutAssignment: { findFirst: jest.fn().mockResolvedValue({ id: 'a1', scheduledDate: new Date(`${today}T00:00:00Z`), workout: { durationMinutes: 55 } }) },
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
  };
  const audit: any = { record: jest.fn() };
  const notifications: any = { notify: jest.fn(), notifyCoachOf: jest.fn() };
  const challenges: any = { syncSession: jest.fn() };
  return { service: new SessionsService(prisma, audit, notifications, challenges), prisma, tx, audit, notifications, challenges };
}

describe('SessionsService.create (HU-19, idempotencia)', () => {
  it('crea la sesión completada y pasa la asignación a COMPLETED en la misma transacción', async () => {
    const { service, tx } = setup();
    const { session, created } = await service.create(user, { assignmentId: 'a1', idempotencyKey: KEY });
    expect(created).toBe(true);
    expect(session).toMatchObject({ status: 'COMPLETED', completionPercentage: 100, durationMinutes: 55 });
    expect(tx.workoutAssignment.updateMany.mock.calls[0][0].data).toEqual({ status: 'COMPLETED' });
    expect(tx.workoutSession.create.mock.calls[0][0].data.idempotencyKey).toBe(KEY);
  });

  it('un reintento con la misma clave devuelve la sesión existente sin crear otra', async () => {
    const { service, prisma, tx } = setup();
    prisma.workoutSession.findFirst.mockResolvedValue(sessionRow());
    const { session, created } = await service.create(user, { assignmentId: 'a1', idempotencyKey: KEY });
    expect(created).toBe(false);
    expect(session.id).toBe('s1');
    expect(tx.workoutSession.create).not.toHaveBeenCalled();
    expect(prisma.workoutAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('dos reintentos simultáneos: el que pierde la carrera (P2002) recibe la sesión del primero', async () => {
    const { service, prisma } = setup();
    prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    prisma.workoutSession.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(sessionRow());
    const { created, session } = await service.create(user, { assignmentId: 'a1', idempotencyKey: KEY });
    expect(created).toBe(false);
    expect(session.id).toBe('s1');
  });

  it('otra clave sobre una asignación ya completada → 409', async () => {
    const { service, tx } = setup();
    tx.workoutAssignment.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.create(user, { assignmentId: 'a1', idempotencyKey: KEY })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.workoutSession.create).not.toHaveBeenCalled();
  });

  it('asignación ajena, inexistente o cancelada → 404', async () => {
    const { service, prisma } = setup();
    prisma.workoutAssignment.findFirst.mockResolvedValue(null);
    await expect(service.create(user, { assignmentId: 'a1', idempotencyKey: KEY })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workoutAssignment.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'a1', userId: 'u1', status: { not: 'CANCELLED' } });
  });

  it('no deja completar un entrenamiento de una fecha futura', async () => {
    const { service, prisma } = setup();
    prisma.workoutAssignment.findFirst.mockResolvedValue({ id: 'a1', scheduledDate: new Date('2099-01-01T00:00:00Z'), workout: { durationMinutes: 55 } });
    await expect(service.create(user, { assignmentId: 'a1', idempotencyKey: KEY })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('con startedAt calcula la duración real (mínimo 1 min) y no acepta inicios en el futuro', async () => {
    const { service, tx } = setup();
    await service.create(user, { assignmentId: 'a1', idempotencyKey: KEY, startedAt: new Date(Date.now() - 30 * 60_000) });
    expect(tx.workoutSession.create.mock.calls[0][0].data.durationMinutes).toBe(30);
    await service.create(user, { assignmentId: 'a1', idempotencyKey: KEY, startedAt: new Date(Date.now() + 3_600_000) });
    const future = tx.workoutSession.create.mock.calls[1][0].data;
    expect(future.startedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe('SessionsService.list', () => {
  it('la usuaria solo ve su historial aunque envíe otro userId; la Coach puede filtrar', async () => {
    const { service, prisma } = setup();
    await service.list(user, { page: 1, limit: 10, userId: 'otra' });
    expect(prisma.workoutSession.findMany.mock.calls[0][0].where).toEqual({ assignment: { userId: 'u1' } });
    await service.list({ id: 'c1', role: 'COACH' } as any, { page: 1, limit: 10, userId: 'u7' });
    expect(prisma.workoutSession.findMany.mock.calls[1][0].where).toEqual({ assignment: { userId: 'u7' } });
  });
});

describe('SessionsService.createFeedback (HU-20)', () => {
  const base = { feelingRating: 4, ateBeforeWorkout: false };
  const withSession = (prisma: any, over: object = {}) => prisma.workoutSession.findFirst.mockResolvedValue({ id: 's1', assignmentId: 'a1', feedback: null, ...over });

  it('Sí: guarda y deja sesión y asignación COMPLETED al 100%', async () => {
    const { service, prisma, tx } = setup();
    withSession(prisma);
    const fb = await service.createFeedback(user, 's1', { ...base, completed: 'YES' } as any);
    expect(fb.completed).toBe('YES');
    expect(tx.workoutSession.update.mock.calls[0][0].data).toEqual({ status: 'COMPLETED', completionPercentage: 100 });
    expect(tx.workoutAssignment.update.mock.calls[0][0].data).toEqual({ status: 'COMPLETED' });
  });

  it('Parcial: estado PARTIAL con el porcentaje indicado', async () => {
    const { service, prisma, tx } = setup();
    withSession(prisma);
    await service.createFeedback(user, 's1', { ...base, completed: 'PARTIAL', completionPercentage: 60 } as any);
    expect(tx.workoutSession.update.mock.calls[0][0].data).toEqual({ status: 'PARTIAL', completionPercentage: 60 });
    expect(tx.workoutAssignment.update.mock.calls[0][0].data).toEqual({ status: 'PARTIAL' });
  });

  it('No: estado SKIPPED, guarda el motivo y descarta datos que no aplican', async () => {
    const { service, prisma, tx } = setup();
    withSession(prisma);
    await service.createFeedback(user, 's1', { ...base, completed: 'NO', notCompletedReason: 'Dolor', completionPercentage: 50, preWorkoutMeal: 'x' } as any);
    const data = tx.workoutFeedback.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ notCompletedReason: 'Dolor', completionPercentage: null, preWorkoutMeal: null });
    expect(tx.workoutSession.update.mock.calls[0][0].data).toEqual({ status: 'SKIPPED', completionPercentage: 0 });
  });

  it('solo se guarda qué comió si dijo que comió', async () => {
    const { service, prisma, tx } = setup();
    withSession(prisma);
    await service.createFeedback(user, 's1', { ...base, completed: 'YES', ateBeforeWorkout: true, preWorkoutMeal: 'Avena' } as any);
    expect(tx.workoutFeedback.create.mock.calls[0][0].data.preWorkoutMeal).toBe('Avena');
  });

  it('segundo feedback de la misma sesión → 409 (también si lo detecta la unicidad)', async () => {
    const { service, prisma } = setup();
    withSession(prisma, { feedback: { id: 'f0' } });
    await expect(service.createFeedback(user, 's1', { ...base, completed: 'YES' } as any)).rejects.toBeInstanceOf(ConflictException);
    withSession(prisma);
    prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    await expect(service.createFeedback(user, 's1', { ...base, completed: 'YES' } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('sesión de otra usuaria → 404', async () => {
    const { service, prisma } = setup();
    prisma.workoutSession.findFirst.mockResolvedValue(null);
    await expect(service.createFeedback(user, 's9', { ...base, completed: 'YES' } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workoutSession.findFirst.mock.calls[0][0].where).toEqual({ id: 's9', assignment: { userId: 'u1' } });
  });
});

describe('SessionsService · notificaciones (HU-25)', () => {
  it('al enviar la retroalimentación avisa a la Coach dentro de la transacción', async () => {
    const { service, prisma, tx, notifications } = setup();
    prisma.workoutSession.findFirst.mockResolvedValue({ id: 's1', assignmentId: 'a1', feedback: null });
    await service.createFeedback(user, 's1', { feelingRating: 4, ateBeforeWorkout: false, completed: 'YES' } as any);
    expect(notifications.notifyCoachOf).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'FEEDBACK_RECEIVED', data: { sessionId: 's1', assignmentId: 'a1' } }), tx);
  });

  it('si ya había retroalimentación (409) no notifica', async () => {
    const { service, prisma, notifications } = setup();
    prisma.workoutSession.findFirst.mockResolvedValue({ id: 's1', assignmentId: 'a1', feedback: { id: 'f' } });
    await expect(service.createFeedback(user, 's1', { feelingRating: 4, ateBeforeWorkout: false, completed: 'YES' } as any)).rejects.toThrow('Ya enviaste');
    expect(notifications.notifyCoachOf).not.toHaveBeenCalled();
  });
});

describe('SessionsService · retos (§4.6)', () => {
  it('al completar la sesión recalcula los retos dentro de la misma transacción', async () => {
    const { service, tx, challenges } = setup();
    await service.create(user, { assignmentId: 'a1', idempotencyKey: KEY });
    expect(challenges.syncSession).toHaveBeenCalledWith(tx, 's1');
  });

  it('un reintento idempotente no vuelve a contar', async () => {
    const { service, prisma, challenges } = setup();
    prisma.workoutSession.findFirst.mockResolvedValue(sessionRow());
    await service.create(user, { assignmentId: 'a1', idempotencyKey: KEY });
    expect(challenges.syncSession).not.toHaveBeenCalled();
  });

  it('la retroalimentación también recalcula (un Parcial o No deja de contar)', async () => {
    const { service, prisma, tx, challenges } = setup();
    prisma.workoutSession.findFirst.mockResolvedValue(sessionRow({ assignmentId: 'a1' }));
    await service.createFeedback(user, 's1', { completed: 'NO', feelingRating: 3, ateBeforeWorkout: false } as any);
    expect(challenges.syncSession).toHaveBeenCalledWith(tx, 's1');
  });
});
