import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MealLogsService } from './meal-logs.service';
import { phaseOf } from './nutrition.mapper';

const user: any = { id: 'u1', role: 'USER', timezone: 'America/Bogota' };
const coach: any = { id: 'c1', role: 'COACH', timezone: 'America/Bogota' };
const row = (over: object = {}) => ({
  id: 'l1', userId: 'u1', plannedMealId: null, mealType: 'LUNCH', description: 'Pollo', imageAssetId: null,
  consumedAt: new Date('2026-11-18T18:00:00Z'), status: 'DRAFT', coachComment: null, reviewedAt: null, createdAt: new Date(), updatedAt: new Date(),
  user: { firstName: 'Ana', lastName: 'Ruiz', timezone: 'America/Bogota' }, plannedMeal: null, ...over,
});

function setup() {
  const tx: any = { mealLog: { updateMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn() } };
  const prisma: any = {
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
    mealLog: {
      create: jest.fn().mockImplementation(async ({ data }: any) => row(data)),
      findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), update: jest.fn().mockImplementation(async ({ data }: any) => row(data)),
      updateMany: jest.fn(), findUniqueOrThrow: jest.fn(), delete: jest.fn(), count: jest.fn().mockResolvedValue(0),
    },
    nutritionPlanMeal: { findFirst: jest.fn() },
    mediaAsset: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
  };
  const audit: any = { record: jest.fn() };
  const notifications: any = { notify: jest.fn(), notifyCoachOf: jest.fn() };
  return { service: new MealLogsService(prisma, audit, notifications), prisma, tx, audit, notifications };
}

describe('MealLogsService · diario (HU-22)', () => {
  it('crea un borrador con la hora local convertida a UTC', async () => {
    const { service, prisma } = setup();
    const dto = await service.create(user, { mealType: 'LUNCH', description: 'Pollo', date: '2020-05-01', time: '13:00' } as any);
    const data = prisma.mealLog.create.mock.calls[0][0].data;
    expect(data.consumedAt.toISOString()).toBe('2020-05-01T18:00:00.000Z'); // 13:00 Bogotá = 18:00 UTC
    expect(data).toMatchObject({ userId: 'u1', plannedMealId: null });
    expect(dto.status).toBe('DRAFT');
  });

  it('sin hora, un día pasado usa la hora típica del tipo de comida', async () => {
    const { service, prisma } = setup();
    await service.create(user, { mealType: 'BREAKFAST', description: 'x', date: '2020-05-01' } as any);
    expect(prisma.mealLog.create.mock.calls[0][0].data.consumedAt.toISOString()).toBe('2020-05-01T13:00:00.000Z'); // 08:00 Bogotá
  });

  it('no permite registrar comidas en el futuro', async () => {
    const { service, prisma } = setup();
    await expect(service.create(user, { mealType: 'LUNCH', description: 'x', date: '2999-01-01', time: '12:00' } as any)).rejects.toThrow('futuro');
    expect(prisma.mealLog.create).not.toHaveBeenCalled();
  });

  it('plannedMealId debe ser de un plan asignado a ella; la foto, suya', async () => {
    const { service, prisma } = setup();
    prisma.nutritionPlanMeal.findFirst.mockResolvedValue(null);
    await expect(service.create(user, { mealType: 'LUNCH', description: 'x', date: '2020-05-01', plannedMealId: 'm9' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.nutritionPlanMeal.findFirst.mock.calls[0][0].where.day.version.assignments).toEqual({ some: { userId: 'u1' } });

    prisma.mediaAsset.findFirst.mockResolvedValue(null);
    await expect(service.create(user, { mealType: 'LUNCH', description: 'x', date: '2020-05-01', imageAssetId: 'a9' } as any)).rejects.toThrow('foto');
    expect(prisma.mediaAsset.findFirst.mock.calls[0][0].where).toEqual({ id: 'a9', ownerId: 'u1' });
  });

  it('el rango diario se calcula en la zona de la usuaria (medianoche local, no UTC)', async () => {
    const { service, prisma } = setup();
    await service.listMine(user, { from: '2026-11-18', to: '2026-11-18' });
    const f = prisma.mealLog.findMany.mock.calls[0][0].where;
    expect(f.userId).toBe('u1');
    expect(f.consumedAt.gte.toISOString()).toBe('2026-11-18T05:00:00.000Z');
    expect(f.consumedAt.lt.toISOString()).toBe('2026-11-19T05:00:00.000Z');
  });

  it('editar: solo borrador o con cambios pedidos; uno ajeno es 404; enviado es 409', async () => {
    const { service, prisma } = setup();
    prisma.mealLog.findFirst.mockResolvedValue(null);
    await expect(service.update(user, 'l1', { description: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.mealLog.findFirst.mock.calls[0][0].where).toEqual({ id: 'l1', userId: 'u1' });
    for (const status of ['SUBMITTED', 'REVIEWED']) {
      prisma.mealLog.findFirst.mockResolvedValue(row({ status }));
      await expect(service.update(user, 'l1', { description: 'x' })).rejects.toBeInstanceOf(ConflictException);
    }
    prisma.mealLog.findFirst.mockResolvedValue(row({ status: 'NEEDS_CHANGES' }));
    await expect(service.update(user, 'l1', { description: 'mejor' })).resolves.toBeDefined();
  });

  it('editar no puede dejar el registro sin descripción ni foto', async () => {
    const { service, prisma } = setup();
    prisma.mealLog.findFirst.mockResolvedValue(row({ description: '', imageAssetId: 'a1' }));
    prisma.mediaAsset.findFirst.mockResolvedValue({ id: 'a1' });
    await expect(service.update(user, 'l1', { imageAssetId: null })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cambiar solo la fecha conserva la hora local anterior', async () => {
    const { service, prisma } = setup();
    prisma.mealLog.findFirst.mockResolvedValue(row({ consumedAt: new Date('2020-05-01T18:00:00Z') })); // 13:00 locales
    await service.update(user, 'l1', { date: '2020-05-02' });
    expect(prisma.mealLog.update.mock.calls[0][0].data.consumedAt.toISOString()).toBe('2020-05-02T18:00:00.000Z');
  });

  it('enviar exige descripción y usa un reclamo atómico (doble envío → 409)', async () => {
    const { service, prisma } = setup();
    prisma.mealLog.findFirst.mockResolvedValue(row({ description: '  ' }));
    await expect(service.submit(user, 'l1')).rejects.toThrow('descripción');

    prisma.mealLog.findFirst.mockResolvedValue(row());
    prisma.mealLog.updateMany.mockResolvedValue({ count: 1 });
    prisma.mealLog.findUniqueOrThrow.mockResolvedValue(row({ status: 'SUBMITTED' }));
    await expect(service.submit(user, 'l1')).resolves.toMatchObject({ status: 'SUBMITTED' });
    expect(prisma.mealLog.updateMany.mock.calls[0][0].where).toEqual({ id: 'l1', userId: 'u1', status: { in: ['DRAFT', 'NEEDS_CHANGES'] } });

    prisma.mealLog.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.submit(user, 'l1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('solo se eliminan borradores', async () => {
    const { service, prisma } = setup();
    prisma.mealLog.findFirst.mockResolvedValue(row({ status: 'SUBMITTED' }));
    await expect(service.remove(user, 'l1')).rejects.toBeInstanceOf(ConflictException);
    prisma.mealLog.findFirst.mockResolvedValue(row());
    await service.remove(user, 'l1');
    expect(prisma.mealLog.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
  });
});

describe('MealLogsService · revisión de la Coach (HU-13)', () => {
  it('la Coach nunca ve borradores', async () => {
    const { service, prisma } = setup();
    await service.listForCoach(coach, { page: 1, limit: 20 } as any);
    expect(prisma.mealLog.findMany.mock.calls[0][0].where.status).toEqual({ not: 'DRAFT' });
    const r = await service.listForCoach(coach, { page: 1, limit: 20, status: 'DRAFT' } as any);
    expect(r.data).toEqual([]);
  });

  it('filtra por usuaria y usa la zona horaria de esa usuaria', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue({ timezone: 'America/Mexico_City' });
    await service.listForCoach(coach, { page: 1, limit: 20, userId: 'u1', from: '2026-11-18', to: '2026-11-18' } as any);
    const w = prisma.mealLog.findMany.mock.calls[0][0].where;
    expect(w.userId).toBe('u1');
    expect(w.consumedAt.gte.toISOString()).toBe('2026-11-18T06:00:00.000Z'); // CDMX UTC-6
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.listForCoach(coach, { page: 1, limit: 20, userId: 'x' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('aprobar guarda revisor, fecha y deja auditoría', async () => {
    const { service, tx, audit } = setup();
    tx.mealLog.updateMany.mockResolvedValue({ count: 1 });
    tx.mealLog.findUniqueOrThrow.mockResolvedValue(row({ status: 'REVIEWED', coachComment: '¡Bien!' }));
    const dto = await service.review(coach, 'l1', { status: 'REVIEWED', comment: '¡Bien!' } as any);
    expect(tx.mealLog.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'l1', status: 'SUBMITTED' },
      data: { status: 'REVIEWED', coachComment: '¡Bien!', reviewedById: 'c1' },
    });
    expect(dto.coachComment).toBe('¡Bien!');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'MEAL_LOG_REVIEWED' }), tx);
  });

  it('solo se revisan registros enviados: ya revisado → 409; borrador o inexistente → 404', async () => {
    const { service, tx } = setup();
    tx.mealLog.updateMany.mockResolvedValue({ count: 0 });
    tx.mealLog.findUnique.mockResolvedValue({ id: 'l1', status: 'REVIEWED' });
    await expect(service.review(coach, 'l1', { status: 'REVIEWED' } as any)).rejects.toBeInstanceOf(ConflictException);
    tx.mealLog.findUnique.mockResolvedValue({ id: 'l1', status: 'DRAFT' });
    await expect(service.review(coach, 'l1', { status: 'REVIEWED' } as any)).rejects.toBeInstanceOf(NotFoundException);
    tx.mealLog.findUnique.mockResolvedValue(null);
    await expect(service.review(coach, 'l1', { status: 'REVIEWED' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('fase de una asignación', () => {
  const a = (status: string, start: string, end: string | null) => ({ status, startDate: new Date(start), endDate: end ? new Date(end) : null });
  it.each([
    [a('ACTIVE', '2026-11-20', null), 'UPCOMING'],
    [a('ACTIVE', '2026-11-01', null), 'CURRENT'],
    [a('ACTIVE', '2026-11-01', '2026-11-18'), 'CURRENT'],
    [a('ACTIVE', '2026-11-01', '2026-11-17'), 'PAST'],
    [a('ENDED', '2026-11-01', null), 'ENDED'],
  ])('%j → %s (hoy = 2026-11-18)', (assignment, expected) => {
    expect(phaseOf(assignment, '2026-11-18')).toBe(expected);
  });
});

describe('MealLogsService · notificaciones (HU-25)', () => {
  it('al enviar avisa a la Coach con una referencia al registro (sin la descripción)', async () => {
    const { service, prisma, notifications } = setup();
    prisma.mealLog.findFirst.mockResolvedValue(row({ description: 'Avena con fruta' }));
    prisma.mealLog.updateMany.mockResolvedValue({ count: 1 });
    prisma.mealLog.findUniqueOrThrow.mockResolvedValue(row({ status: 'SUBMITTED' }));
    await service.submit(user, 'l1');
    expect(notifications.notifyCoachOf).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'MEAL_LOG_PENDING_REVIEW', data: { mealLogId: 'l1' } }));
    expect(JSON.stringify(notifications.notifyCoachOf.mock.calls)).not.toContain('Avena');
  });

  it('un envío rechazado (409) no notifica', async () => {
    const { service, prisma, notifications } = setup();
    prisma.mealLog.findFirst.mockResolvedValue(row());
    prisma.mealLog.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.submit(user, 'l1')).rejects.toBeInstanceOf(ConflictException);
    expect(notifications.notifyCoachOf).not.toHaveBeenCalled();
  });

  it('al revisar avisa a la usuaria dentro de la misma transacción', async () => {
    const { service, tx, notifications } = setup();
    tx.mealLog.updateMany.mockResolvedValue({ count: 1 });
    tx.mealLog.findUniqueOrThrow.mockResolvedValue(row({ status: 'NEEDS_CHANGES', coachComment: 'Falta la porción' }));
    await service.review(coach, 'l1', { status: 'NEEDS_CHANGES', comment: 'Falta la porción' } as any);
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', type: 'MEAL_LOG_REVIEWED', message: 'Falta la porción' }), tx);
  });

  it('una revisión rechazada no notifica', async () => {
    const { service, tx, notifications } = setup();
    tx.mealLog.updateMany.mockResolvedValue({ count: 0 });
    tx.mealLog.findUnique.mockResolvedValue({ id: 'l1', status: 'REVIEWED' });
    await expect(service.review(coach, 'l1', { status: 'REVIEWED' } as any)).rejects.toBeInstanceOf(ConflictException);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
