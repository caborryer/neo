import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NutritionPlansService } from './plans.service';

const now = new Date('2026-11-18T12:00:00Z');
const tree = (over: object = {}) => ({
  id: 'v1', planId: 'p1', versionNumber: 1, notes: null, publishedAt: null, createdAt: now,
  days: [{ id: 'd1', dayNumber: 1, dayName: 'MONDAY', meals: [{ id: 'm1', mealType: 'BREAKFAST', title: 'Desayuno', scheduledTime: '07:00', instructions: null, foods: [{ id: 'f1', name: 'Avena', quantity: new Prisma.Decimal('50'), unit: 'GRAMS', notes: null }] }] }],
  ...over,
});
const planRow = (over: object = {}) => ({
  id: 'p1', name: 'Plan', description: null, isTemplate: false, isActive: true, createdAt: now, updatedAt: now,
  versions: [{ id: 'v1', versionNumber: 1, notes: null, publishedAt: null, createdAt: now, _count: { assignments: 0 } }], ...over,
});
const assignRow = (over: object = {}) => ({
  id: 'a1', userId: 'u1', versionId: 'v1', startDate: new Date('2026-11-20'), endDate: null, status: 'ACTIVE', createdAt: now,
  user: { firstName: 'Ana', lastName: 'Ruiz', timezone: 'America/Bogota' }, version: { versionNumber: 1, planId: 'p1', plan: { name: 'Plan', description: null } }, ...over,
});

function setup() {
  const tx: any = {
    nutritionPlan: { create: jest.fn().mockResolvedValue(planRow()), findUnique: jest.fn(), update: jest.fn().mockResolvedValue(planRow()) },
    nutritionPlanVersion: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    nutritionPlanDay: { deleteMany: jest.fn() },
    nutritionPlanMeal: { deleteMany: jest.fn() },
    nutritionPlanFood: { deleteMany: jest.fn() },
    nutritionPlanAssignment: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
  };
  const prisma: any = {
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
    nutritionPlan: { findUnique: jest.fn() },
    nutritionPlanVersion: { findFirst: jest.fn() },
    nutritionPlanAssignment: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  const audit: any = { record: jest.fn() };
  const notifications: any = { notify: jest.fn(), notifyCoachOf: jest.fn() };
  return { service: new NutritionPlansService(prisma, audit, notifications), prisma, tx, audit, notifications };
}
const future = '2999-01-10';

describe('NutritionPlansService · versionado (HU-11)', () => {
  it('crea el plan con su versión 1 en borrador y deja auditoría', async () => {
    const { service, tx, audit } = setup();
    const dto = await service.create('c1', { name: 'Plan', isTemplate: false, days: [{ dayName: 'MONDAY', meals: [{ mealType: 'BREAKFAST', title: 'Desayuno', foods: [{ name: 'Avena', quantity: 50, unit: 'GRAMS' }] }] }] } as any);
    const data = tx.nutritionPlan.create.mock.calls[0][0].data;
    expect(data.versions.create).toMatchObject({ versionNumber: 1 });
    expect(data.versions.create.days.create[0]).toMatchObject({ dayNumber: 1, dayName: 'MONDAY' });
    expect(dto.hasDraft).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'NUTRITION_PLAN_CREATED' }), tx);
  });

  it('guardar un borrador reemplaza el contenido; una versión publicada es inmutable (409)', async () => {
    const { service, tx } = setup();
    tx.nutritionPlanVersion.findFirst.mockResolvedValue({ id: 'v1', publishedAt: null });
    tx.nutritionPlanVersion.update.mockResolvedValue(tree());
    await service.saveDraft('c1', 'p1', 'v1', { notes: 'x', days: [] } as any);
    expect(tx.nutritionPlanFood.deleteMany).toHaveBeenCalled();
    expect(tx.nutritionPlanDay.deleteMany).toHaveBeenCalledWith({ where: { versionId: 'v1' } });

    tx.nutritionPlanVersion.findFirst.mockResolvedValue({ id: 'v1', publishedAt: now });
    tx.nutritionPlanDay.deleteMany.mockClear();
    await expect(service.saveDraft('c1', 'p1', 'v1', { days: [] } as any)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.nutritionPlanDay.deleteMany).not.toHaveBeenCalled();
  });

  it('una versión de otro plan o inexistente → 404', async () => {
    const { service, tx } = setup();
    tx.nutritionPlanVersion.findFirst.mockResolvedValue(null);
    await expect(service.saveDraft('c1', 'p1', 'vX', { days: [] } as any)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.publish('c1', 'p1', 'vX')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('publicar exige contenido: sin comidas o con comidas sin alimentos → 400 con detalle', async () => {
    const { service, tx } = setup();
    tx.nutritionPlanVersion.findFirst.mockResolvedValue(tree({ days: [] }));
    await expect(service.publish('c1', 'p1', 'v1')).rejects.toBeInstanceOf(BadRequestException);

    const empty = tree();
    empty.days[0]!.meals[0]!.foods = [];
    tx.nutritionPlanVersion.findFirst.mockResolvedValue(empty);
    await expect(service.publish('c1', 'p1', 'v1')).rejects.toMatchObject({ response: { details: [{ message: expect.stringContaining('Desayuno') }] } });
    expect(tx.nutritionPlanVersion.updateMany).not.toHaveBeenCalled();
  });

  it('publicar congela la versión con un reclamo atómico; doble publicación → 409', async () => {
    const { service, tx, audit } = setup();
    tx.nutritionPlanVersion.findFirst.mockResolvedValue(tree());
    tx.nutritionPlanVersion.updateMany.mockResolvedValue({ count: 1 });
    tx.nutritionPlanVersion.findUniqueOrThrow.mockResolvedValue(tree({ publishedAt: now }));
    const dto = await service.publish('c1', 'p1', 'v1');
    expect(tx.nutritionPlanVersion.updateMany.mock.calls[0][0].where).toEqual({ id: 'v1', publishedAt: null });
    expect(dto.publishedAt).toBeTruthy();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'NUTRITION_VERSION_PUBLISHED' }), tx);

    tx.nutritionPlanVersion.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.publish('c1', 'p1', 'v1')).rejects.toBeInstanceOf(ConflictException);
    tx.nutritionPlanVersion.findFirst.mockResolvedValue(tree({ publishedAt: now }));
    await expect(service.publish('c1', 'p1', 'v1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('nueva versión: copia la última con número +1; si ya hay borrador → 409', async () => {
    const { service, tx } = setup();
    tx.nutritionPlan.findUnique.mockResolvedValue({ id: 'p1' });
    tx.nutritionPlanVersion.findFirst.mockResolvedValue(tree({ versionNumber: 2, publishedAt: now }));
    tx.nutritionPlanVersion.create.mockResolvedValue(tree({ versionNumber: 3 }));
    const dto = await service.createVersion('c1', 'p1');
    const data = tx.nutritionPlanVersion.create.mock.calls[0][0].data;
    expect(data.versionNumber).toBe(3);
    expect(data.days.create[0].meals.create[0].foods.create[0]).toMatchObject({ name: 'Avena', quantity: 50 });
    expect(dto.versionNumber).toBe(3);

    tx.nutritionPlanVersion.findFirst.mockResolvedValue(tree({ publishedAt: null }));
    await expect(service.createVersion('c1', 'p1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('dos "nueva versión" simultáneas: la restricción única se traduce a 409', async () => {
    const { service, tx } = setup();
    tx.nutritionPlan.findUnique.mockResolvedValue({ id: 'p1' });
    tx.nutritionPlanVersion.findFirst.mockResolvedValue(tree({ publishedAt: now }));
    tx.nutritionPlanVersion.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    await expect(service.createVersion('c1', 'p1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('duplicar crea un plan nuevo en borrador con el contenido de la última versión', async () => {
    const { service, tx } = setup();
    tx.nutritionPlan.findUnique.mockResolvedValue({ description: 'd' });
    tx.nutritionPlanVersion.findFirst.mockResolvedValue(tree({ publishedAt: now }));
    await service.duplicate('c1', 'p1', { name: 'Copia', isTemplate: true });
    const data = tx.nutritionPlan.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: 'Copia', isTemplate: true, createdById: 'c1' });
    expect(data.versions.create.versionNumber).toBe(1);
    expect(data.versions.create.days.create).toHaveLength(1);
  });
});

describe('NutritionPlansService · asignación (HU-12)', () => {
  const input = (over: object = {}) => ({ versionId: 'v1', userIds: ['u1'], startDate: future, endDate: null, ...over }) as any;
  const published = { id: 'v1', publishedAt: now, plan: { isActive: true } };

  it('no asigna borradores ni planes archivados', async () => {
    const { service, prisma } = setup();
    prisma.nutritionPlanVersion.findFirst.mockResolvedValue({ ...published, publishedAt: null });
    await expect(service.assign('c1', 'p1', input())).rejects.toThrow('Publica la versión');
    prisma.nutritionPlanVersion.findFirst.mockResolvedValue({ ...published, plan: { isActive: false } });
    await expect(service.assign('c1', 'p1', input())).rejects.toThrow('archivado');
    prisma.nutritionPlanVersion.findFirst.mockResolvedValue(null);
    await expect(service.assign('c1', 'p1', input())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('omite con motivo a usuarias inexistentes, inactivas o con fecha pasada, sin frenar al resto', async () => {
    const { service, prisma, tx } = setup();
    prisma.nutritionPlanVersion.findFirst.mockResolvedValue(published);
    prisma.user.findMany.mockResolvedValue([
      { id: 'ok', status: 'ACTIVE', timezone: 'America/Bogota' },
      { id: 'sus', status: 'SUSPENDED', timezone: 'America/Bogota' },
    ]);
    tx.nutritionPlanAssignment.create.mockResolvedValue(assignRow({ userId: 'ok' }));
    const r = await service.assign('c1', 'p1', input({ userIds: ['ok', 'sus', 'nadie'] }));
    expect(r.created).toHaveLength(1);
    expect(r.skipped).toEqual([{ userId: 'sus', reason: expect.stringContaining('acceso') }, { userId: 'nadie', reason: 'Usuaria no encontrada' }]);

    const past = await service.assign('c1', 'p1', input({ userIds: ['ok'], startDate: '2000-01-01' }));
    expect(past.created).toEqual([]);
    expect(past.skipped[0]!.reason).toContain('pasó');
  });

  it('al reemplazar: la activa que ya empezó termina el día anterior y la futura se descarta', async () => {
    const { service, prisma, tx } = setup();
    prisma.nutritionPlanVersion.findFirst.mockResolvedValue(published);
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', status: 'ACTIVE', timezone: 'America/Bogota' }]);
    tx.nutritionPlanAssignment.findMany.mockResolvedValue([
      { id: 'old-started', startDate: new Date('2026-11-01T00:00:00Z') },
      { id: 'old-future', startDate: new Date('3000-01-01T00:00:00Z') },
    ]);
    tx.nutritionPlanAssignment.create.mockResolvedValue(assignRow());
    await service.assign('c1', 'p1', input({ startDate: '2999-01-10' }));
    const updates = tx.nutritionPlanAssignment.update.mock.calls.map((c: any) => c[0]);
    expect(updates[0]).toEqual({ where: { id: 'old-started' }, data: { status: 'ENDED', endDate: new Date('2999-01-09T00:00:00Z') } });
    expect(updates[1]).toEqual({ where: { id: 'old-future' }, data: { status: 'ENDED' } });
    // La búsqueda de solapes solo mira asignaciones ACTIVE de esa usuaria.
    expect(tx.nutritionPlanAssignment.findMany.mock.calls[0][0].where).toMatchObject({ userId: 'u1', status: 'ACTIVE' });
  });

  it('usa transacción serializable y traduce el conflicto de concurrencia a 409', async () => {
    const { service, prisma } = setup();
    prisma.nutritionPlanVersion.findFirst.mockResolvedValue(published);
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', status: 'ACTIVE', timezone: 'America/Bogota' }]);
    prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'x' }));
    await expect(service.assign('c1', 'p1', input())).rejects.toBeInstanceOf(ConflictException);

    prisma.$transaction.mockImplementationOnce(async () => []);
    await service.assign('c1', 'p1', input());
    expect(prisma.$transaction.mock.calls.at(-1)![1]).toEqual({ isolationLevel: 'Serializable' });
  });

  it('el historial de una usuaria inexistente (o una Coach) → 404', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.listForUser('x')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject({ role: 'USER' });
  });

  it('finalizar una asignación: solo activas; la que ya empezó termina hoy', async () => {
    const { service, tx } = setup();
    tx.nutritionPlanAssignment.findUnique.mockResolvedValue(assignRow({ status: 'ENDED' }));
    await expect(service.endAssignment('c1', 'a1')).rejects.toBeInstanceOf(ConflictException);
    tx.nutritionPlanAssignment.findUnique.mockResolvedValue(assignRow({ startDate: new Date('2020-01-01') }));
    tx.nutritionPlanAssignment.update.mockResolvedValue(assignRow({ status: 'ENDED' }));
    await service.endAssignment('c1', 'a1');
    expect(tx.nutritionPlanAssignment.update.mock.calls[0][0].data).toMatchObject({ status: 'ENDED', endDate: expect.any(Date) });
  });
});

describe('NutritionPlansService · notificaciones (HU-25)', () => {
  const input = (over: object = {}) => ({ versionId: 'v1', userIds: ['u1'], startDate: '2099-01-15', endDate: null, ...over }) as any;
  const published = { id: 'v1', publishedAt: new Date() };
  it('asignar un plan avisa a cada usuaria asignada, en la misma transacción', async () => {
    const { service, prisma, tx, notifications } = setup();
    prisma.nutritionPlanVersion.findFirst.mockResolvedValue({ ...published, plan: { isActive: true, name: 'Definición' } });
    prisma.user.findMany.mockResolvedValue([{ id: 'ok', status: 'ACTIVE', timezone: 'America/Bogota' }]);
    tx.nutritionPlanAssignment.create.mockResolvedValue(assignRow({ userId: 'ok' }));
    await service.assign('c1', 'p1', input({ userIds: ['ok'] }));
    const [entries, db] = notifications.notify.mock.calls[0];
    expect(db).toBe(tx);
    expect(entries[0]).toMatchObject({ userId: 'ok', type: 'NUTRITION_PLAN_ASSIGNED' });
    expect(entries[0].message).toContain('Definición');
  });
});
