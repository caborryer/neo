import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';

const FUTURE = '2099-01-15';
const wRow = { id: 'w1', title: 'Full Body', description: null, durationMinutes: 55, difficulty: 'INTERMEDIATE', category: 'FULL_BODY', videoProvider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ', videoVisibility: 'UNLISTED', equipment: [], tips: [], isPublished: true, createdAt: new Date(), updatedAt: new Date() };
const aRow = (over: object = {}) => ({ id: 'a1', scheduledDate: new Date(`${FUTURE}T00:00:00Z`), scheduledTime: null, status: 'SCHEDULED', workout: wRow, user: { id: 'u1', firstName: 'Ana', lastName: 'Ruiz' }, sessions: [], ...over });

function setup() {
  const tx: any = {
    workoutAssignment: { create: jest.fn().mockImplementation(async ({ data }: any) => aRow({ id: `a-${data.userId}`, user: { id: data.userId, firstName: 'X', lastName: 'Y' } })), findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockImplementation(async ({ data }: any) => aRow({ ...data })) },
  };
  const prisma: any = {
    workout: { findUnique: jest.fn().mockResolvedValue(wRow) },
    user: { findMany: jest.fn() },
    workoutAssignment: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const audit: any = { record: jest.fn() };
  const notifications: any = { notify: jest.fn(), notifyCoachOf: jest.fn() };
  return { service: new AssignmentsService(prisma, audit, notifications), prisma, tx, audit, notifications };
}
const input = (over: object = {}) => ({ workoutId: 'w1', userIds: ['u1'], scheduledDate: FUTURE, ...over }) as any;
const u = (id: string, over: object = {}) => ({ id, status: 'ACTIVE', timezone: 'America/Bogota', ...over });

describe('AssignmentsService.create (HU-10)', () => {
  it('asigna a varias usuarias y deja una auditoría', async () => {
    const { service, prisma, tx, audit } = setup();
    prisma.user.findMany.mockResolvedValue([u('u1'), u('u2')]);
    const res = await service.create('c1', input({ userIds: ['u1', 'u2', 'u2'] }));
    expect(res.created).toHaveLength(2);
    expect(tx.workoutAssignment.create).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('no asigna clases en borrador', async () => {
    const { service, prisma } = setup();
    prisma.workout.findUnique.mockResolvedValue({ ...wRow, isPublished: false });
    await expect(service.create('c1', input())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clase inexistente → 404', async () => {
    const { service, prisma } = setup();
    prisma.workout.findUnique.mockResolvedValue(null);
    await expect(service.create('c1', input())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('omite con motivo: inexistentes, sin acceso activo, fecha pasada y duplicadas; crea el resto', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([u('ok'), u('susp', { status: 'SUSPENDED' }), u('dup')]);
    prisma.workoutAssignment.findMany.mockResolvedValue([{ userId: 'dup' }]);
    const res = await service.create('c1', input({ userIds: ['ok', 'susp', 'dup', 'ghost'] }));
    expect(res.created.map((c) => c.user.id)).toEqual(['ok']);
    expect(Object.fromEntries(res.skipped.map((s) => [s.userId, s.reason]))).toEqual({
      susp: 'La usuaria no tiene el acceso activo',
      dup: 'Ya tiene esta clase en esa fecha',
      ghost: 'Usuaria no encontrada',
    });
  });

  it('fecha pasada (en la zona de la usuaria) se omite', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([u('u1')]);
    const res = await service.create('c1', input({ scheduledDate: '2020-01-01' }));
    expect(res.created).toEqual([]);
    expect(res.skipped[0]!.reason).toMatch(/ya pasó/);
  });

  it('si ninguna es elegible no abre transacción', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([]);
    await service.create('c1', input());
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('AssignmentsService.update (reprogramar/cancelar)', () => {
  const current = (over: object = {}) => ({ id: 'a1', userId: 'u1', workoutId: 'w1', status: 'SCHEDULED', user: { timezone: 'America/Bogota' }, ...over });

  it('cancela una asignación programada', async () => {
    const { service, tx, audit } = setup();
    tx.workoutAssignment.findUnique.mockResolvedValue(current());
    await service.update('c1', 'a1', { status: 'CANCELLED' } as any);
    expect(tx.workoutAssignment.update.mock.calls[0][0].data).toEqual({ status: 'CANCELLED' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'WORKOUT_ASSIGNMENT_CANCELLED' }), tx);
  });

  it.each(['COMPLETED', 'PARTIAL', 'SKIPPED', 'CANCELLED'])('una asignación %s no se puede modificar → 409', async (status) => {
    const { service, tx } = setup();
    tx.workoutAssignment.findUnique.mockResolvedValue(current({ status }));
    await expect(service.update('c1', 'a1', { scheduledDate: FUTURE } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('reprograma fecha y hora; permite quitar la hora con null', async () => {
    const { service, tx } = setup();
    tx.workoutAssignment.findUnique.mockResolvedValue(current());
    await service.update('c1', 'a1', { scheduledDate: FUTURE, scheduledTime: null } as any);
    const data = tx.workoutAssignment.update.mock.calls[0][0].data;
    expect(data.scheduledTime).toBeNull();
    expect(data.scheduledDate).toEqual(new Date(`${FUTURE}T00:00:00.000Z`));
  });

  it('rechaza fecha pasada y choque con otra asignación igual', async () => {
    const { service, tx } = setup();
    tx.workoutAssignment.findUnique.mockResolvedValue(current());
    await expect(service.update('c1', 'a1', { scheduledDate: '2020-01-01' } as any)).rejects.toBeInstanceOf(BadRequestException);
    tx.workoutAssignment.findFirst.mockResolvedValue({ id: 'otra' });
    await expect(service.update('c1', 'a1', { scheduledDate: FUTURE } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('asignación inexistente → 404', async () => {
    const { service, tx } = setup();
    tx.workoutAssignment.findUnique.mockResolvedValue(null);
    await expect(service.update('c1', 'x', { status: 'CANCELLED' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AssignmentsService.list / get (RNF-19)', () => {
  const range = { from: '2099-01-01', to: '2099-01-31' } as any;
  const coach: any = { id: 'c1', role: 'COACH' };
  const member: any = { id: 'u1', role: 'USER' };

  it('la usuaria solo consulta lo suyo aunque envíe otro userId, y sin canceladas', async () => {
    const { service, prisma } = setup();
    prisma.workoutAssignment.findMany.mockResolvedValue([]);
    await service.list(member, { ...range, userId: 'otra' });
    const where = prisma.workoutAssignment.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('u1');
    expect(where.status).toEqual({ not: 'CANCELLED' });
  });

  it('la usuaria no puede pedir las canceladas filtrando por estado', async () => {
    const { service, prisma } = setup();
    await service.list(member, { ...range, status: 'CANCELLED' });
    expect(prisma.workoutAssignment.findMany.mock.calls[0][0].where.status).toEqual({ not: 'CANCELLED' });
  });

  it('la Coach filtra por usuaria y ve canceladas', async () => {
    const { service, prisma } = setup();
    await service.list(coach, { ...range, userId: 'u7', status: 'CANCELLED' });
    expect(prisma.workoutAssignment.findMany.mock.calls[0][0].where).toMatchObject({ userId: 'u7', status: 'CANCELLED' });
  });

  it('detalle ajeno o cancelado para la usuaria → 404', async () => {
    const { service, prisma } = setup();
    prisma.workoutAssignment.findFirst.mockResolvedValue(null);
    await expect(service.get(member, 'a1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workoutAssignment.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'a1', userId: 'u1', status: { not: 'CANCELLED' } });
  });

  it('el detalle incluye el video y las fechas como YYYY-MM-DD', async () => {
    const { service, prisma } = setup();
    prisma.workoutAssignment.findFirst.mockResolvedValue(aRow());
    const dto = await service.get(coach, 'a1');
    expect(dto.scheduledDate).toBe(FUTURE);
    expect(dto.workout.videoId).toBe('dQw4w9WgXcQ');
  });
});

describe('AssignmentsService · notificaciones (HU-25)', () => {
  it('asignar avisa a cada usuaria elegible (no a las omitidas), en la misma transacción', async () => {
    const { service, prisma, tx, notifications } = setup();
    prisma.user.findMany.mockResolvedValue([u('u1'), u('u2', { status: 'SUSPENDED' })]);
    await service.create('c1', input({ userIds: ['u1', 'u2'] }));
    const [entries, db] = notifications.notify.mock.calls[0];
    expect(db).toBe(tx);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ userId: 'u1', type: 'WORKOUT_ASSIGNED', data: { assignmentId: 'a-u1' } });
  });

  it('si no hay usuarias elegibles no notifica', async () => {
    const { service, prisma, notifications } = setup();
    prisma.user.findMany.mockResolvedValue([u('u1', { status: 'SUSPENDED' })]);
    await service.create('c1', input());
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('reprogramar avisa a la usuaria; cancelar no', async () => {
    const { service, tx, notifications } = setup();
    tx.workoutAssignment.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1', workoutId: 'w1', status: 'SCHEDULED', user: { timezone: 'America/Bogota' } });
    await service.update('c1', 'a1', { scheduledDate: FUTURE } as any);
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', type: 'WORKOUT_RESCHEDULED', data: { assignmentId: 'a1' } }), tx);
    notifications.notify.mockClear();
    await service.update('c1', 'a1', { status: 'CANCELLED' } as any);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
