import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ChallengesService } from './challenges.service';

const d = (v: string) => new Date(`${v}T00:00:00Z`);
const challenge = (over: object = {}) => ({
  id: 'ch1', name: 'ABS Septiembre', description: null, category: 'ABS', goal: 3, goalUnit: 'WORKOUT_SESSIONS',
  startDate: d('2000-01-01'), endDate: d('2999-12-31'), isActive: true, createdById: 'c1', createdAt: new Date(), ...over,
});
const participant = (over: object = {}) => ({ id: 'p1', userId: 'u1', challengeId: 'ch1', progress: 0, status: 'IN_PROGRESS', joinedAt: new Date('2026-01-01T00:00:00Z'), ...over });

function setup() {
  const tx: any = {
    challenge: { create: jest.fn().mockImplementation(async ({ data }: any) => challenge(data)), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn().mockImplementation(async ({ data }: any) => challenge(data)) },
    challengeParticipant: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockImplementation(async ({ data }: any) => participant(data)), update: jest.fn().mockImplementation(async ({ data }: any) => participant(data)), count: jest.fn().mockResolvedValue(1) },
    challengeActivity: { createMany: jest.fn(), deleteMany: jest.fn(), aggregate: jest.fn().mockResolvedValue({ _sum: { contribution: 0 } }) },
    workoutSession: { findUnique: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]) },
  };
  const prisma: any = {
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
    challenge: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), findFirst: jest.fn() },
    challengeParticipant: { findUnique: jest.fn(), findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
  };
  const audit: any = { record: jest.fn() };
  const notifications: any = { notify: jest.fn() };
  return { service: new ChallengesService(prisma, audit, notifications), prisma, tx, audit, notifications };
}
const coach: any = { id: 'c1', role: 'COACH', timezone: 'America/Bogota' };
const user: any = { id: 'u1', role: 'USER', timezone: 'America/Bogota' };
const input = { name: 'ABS', category: 'ABS', goal: 12, startDate: '2026-09-01', endDate: '2026-09-30', published: false };

describe('ChallengesService · Coach (HU-29)', () => {
  it('crea el reto sin publicar y sin avisar a nadie', async () => {
    const { service, tx, audit, notifications } = setup();
    const dto = await service.create(coach, input as any);
    expect(tx.challenge.create.mock.calls[0][0].data).toMatchObject({ isActive: false, createdById: 'c1', goal: 12 });
    expect(dto).toMatchObject({ published: false, startDate: '2026-09-01', participantCount: 0 });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'CHALLENGE_CREATED' }), tx);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('crearlo publicado avisa a las usuarias activas', async () => {
    const { service, tx, notifications } = setup();
    await service.create(coach, { ...input, published: true } as any);
    expect(tx.user.findMany.mock.calls[0][0].where).toEqual({ role: 'USER', status: 'ACTIVE' });
    const sent = notifications.notify.mock.calls.at(-1)[0];
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ userId: 'u1', type: 'CHALLENGE_PUBLISHED', data: { challengeId: 'ch1' } });
  });

  it('publicar un reto existente audita y avisa; volver a guardarlo ya publicado no avisa de nuevo', async () => {
    const { service, tx, audit, notifications } = setup();
    tx.challenge.findUnique.mockResolvedValue({ ...challenge({ isActive: false }), _count: { participants: 0 } });
    await service.update(coach, 'ch1', { published: true } as any);
    expect(audit.record).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'CHALLENGE_PUBLISHED' }), tx);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    tx.challenge.findUnique.mockResolvedValue({ ...challenge({ isActive: true }), _count: { participants: 0 } });
    await service.update(coach, 'ch1', { published: true } as any);
    expect(audit.record).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'CHALLENGE_UPDATED' }), tx);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('con participantes no deja cambiar meta ni fechas, pero sí el nombre', async () => {
    const { service, tx } = setup();
    tx.challenge.findUnique.mockResolvedValue({ ...challenge(), _count: { participants: 2 } });
    await expect(service.update(coach, 'ch1', { goal: 5 } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(coach, 'ch1', { endDate: '2999-01-01' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(coach, 'ch1', { name: 'Nuevo nombre' } as any)).resolves.toBeDefined();
  });

  it('valida la combinación de fechas al editar y el 404', async () => {
    const { service, tx } = setup();
    tx.challenge.findUnique.mockResolvedValue({ ...challenge({ startDate: d('2026-09-10') }), _count: { participants: 0 } });
    await expect(service.update(coach, 'ch1', { endDate: '2026-09-01' } as any)).rejects.toBeInstanceOf(BadRequestException);
    tx.challenge.findUnique.mockResolvedValue(null);
    await expect(service.update(coach, 'x', { name: 'a' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('el detalle de la Coach lista participantes con su progreso y no cuenta a quien abandonó', async () => {
    const { service, prisma } = setup();
    prisma.challenge.findUnique.mockResolvedValue({
      ...challenge(),
      participants: [
        { ...participant({ progress: 2 }), user: { firstName: 'Ana', lastName: 'Ruiz' } },
        { ...participant({ id: 'p2', userId: 'u2', status: 'ABANDONED' }), user: { firstName: 'Bea', lastName: 'Gil' } },
      ],
    });
    const dto = await service.getForCoach(coach, 'ch1');
    expect(dto.participantCount).toBe(1);
    expect(dto.participants.map((p) => [p.name, p.progress, p.status])).toEqual([['Ana Ruiz', 2, 'IN_PROGRESS'], ['Bea Gil', 0, 'ABANDONED']]);
  });
});

describe('ChallengesService · usuaria (HU-30)', () => {
  it('la lista solo trae retos publicados', async () => {
    const { service, prisma } = setup();
    await service.listForUser(user, { page: 1, limit: 10, sortOrder: 'desc' } as any);
    expect(prisma.challenge.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
  });

  it('un reto sin publicar es 404 para ella (también al inscribirse)', async () => {
    const { service, prisma, tx } = setup();
    prisma.challenge.findFirst.mockResolvedValue(null);
    tx.challenge.findFirst.mockResolvedValue(null);
    await expect(service.getForUser(user, 'ch1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.join(user, 'ch1')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.challenge.findFirst.mock.calls[0][0].where).toEqual({ id: 'ch1', isActive: true });
  });

  it('se inscribe y queda auditado', async () => {
    const { service, tx, audit } = setup();
    tx.challenge.findFirst.mockResolvedValue(challenge());
    const dto = await service.join(user, 'ch1');
    expect(tx.challengeParticipant.create.mock.calls[0][0].data).toEqual({ userId: 'u1', challengeId: 'ch1' });
    expect(dto.my).toMatchObject({ status: 'IN_PROGRESS', progress: 0 });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'CHALLENGE_JOINED' }), tx);
  });

  it('no se inscribe dos veces (409) ni a un reto terminado', async () => {
    const { service, tx } = setup();
    tx.challenge.findFirst.mockResolvedValue(challenge());
    tx.challengeParticipant.findUnique.mockResolvedValue(participant());
    await expect(service.join(user, 'ch1')).rejects.toBeInstanceOf(ConflictException);
    tx.challenge.findFirst.mockResolvedValue(challenge({ endDate: d('2000-02-01') }));
    await expect(service.join(user, 'ch1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('al reinscribirse tras abandonar conserva su historial (no crea otra fila)', async () => {
    const { service, tx } = setup();
    tx.challenge.findFirst.mockResolvedValue(challenge());
    tx.challengeParticipant.findUnique.mockResolvedValue(participant({ status: 'ABANDONED', progress: 2 }));
    await service.join(user, 'ch1');
    expect(tx.challengeParticipant.create).not.toHaveBeenCalled();
    expect(tx.challengeParticipant.update.mock.calls[0][0]).toMatchObject({ where: { id: 'p1' }, data: { status: 'IN_PROGRESS' } });
  });

  it('abandona conservando el progreso; si ya completó, no puede', async () => {
    const { service, tx } = setup();
    tx.challenge.findFirst.mockResolvedValue(challenge());
    tx.challengeParticipant.findUnique.mockResolvedValue(participant({ progress: 2 }));
    await service.leave(user, 'ch1');
    expect(tx.challengeParticipant.update.mock.calls[0][0].data).toEqual({ status: 'ABANDONED' });
    tx.challengeParticipant.findUnique.mockResolvedValue(participant({ status: 'COMPLETED' }));
    await expect(service.leave(user, 'ch1')).rejects.toBeInstanceOf(BadRequestException);
    tx.challengeParticipant.findUnique.mockResolvedValue(null);
    await expect(service.leave(user, 'ch1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('su progreso es solo el propio y exige inscripción', async () => {
    const { service, prisma } = setup();
    prisma.challengeParticipant.findFirst.mockResolvedValue(null);
    await expect(service.progress(user, 'ch1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.challengeParticipant.findFirst.mock.calls[0][0].where).toMatchObject({ userId: 'u1', challengeId: 'ch1' });
    prisma.challengeParticipant.findFirst.mockResolvedValue({
      ...participant({ progress: 1 }), challenge: { goal: 3 },
      activities: [{ workoutSessionId: 's1', createdAt: new Date(), workoutSession: { completedAt: new Date('2026-09-02T12:00:00Z'), assignment: { workout: { title: 'Abs 20' } } } }],
    });
    const dto = await service.progress(user, 'ch1');
    expect(dto).toMatchObject({ goal: 3, progress: 1, activities: [{ sessionId: 's1', workoutTitle: 'Abs 20' }] });
  });
});

describe('ChallengesService.syncSession (§4.6: el progreso lo decide el servidor)', () => {
  const at = (iso: string) => new Date(iso);
  const session = (over: object = {}) => ({ id: 's1', status: 'COMPLETED', completedAt: at('2026-09-05T15:00:00Z'), assignment: { userId: 'u1', user: { timezone: 'America/Bogota' } }, ...over });
  const withP = (tx: any, p: object = {}, ch: object = {}) =>
    tx.challengeParticipant.findMany.mockResolvedValue([{ ...participant({ joinedAt: at('2026-09-01T00:00:00Z'), ...p }), challenge: challenge({ startDate: d('2026-09-01'), endDate: d('2026-09-30'), ...ch }) }]);

  it('una sesión completada dentro de las fechas suma una vez (con unicidad en base de datos)', async () => {
    const { service, tx } = setup();
    tx.workoutSession.findUnique.mockResolvedValue(session());
    withP(tx);
    tx.challengeActivity.aggregate.mockResolvedValue({ _sum: { contribution: 1 } });
    await service.syncSession(tx, 's1');
    expect(tx.challengeActivity.createMany).toHaveBeenCalledWith({ data: [{ participantId: 'p1', workoutSessionId: 's1' }], skipDuplicates: true });
    expect(tx.challengeParticipant.update.mock.calls[0][0]).toMatchObject({ data: { progress: 1, status: 'IN_PROGRESS' } });
  });

  it.each([
    ['parcial', session({ status: 'PARTIAL' }), {}, {}],
    ['no realizada', session({ status: 'SKIPPED' }), {}, {}],
    ['anterior a la inscripción', session(), { joinedAt: at('2026-09-10T00:00:00Z') }, {}],
    ['antes del inicio del reto', session(), {}, { startDate: d('2026-09-20') }],
    ['después del fin del reto', session(), {}, { endDate: d('2026-09-02') }],
  ])('sesión %s: no cuenta y retira cualquier conteo previo', async (_n, s, p, ch) => {
    const { service, tx } = setup();
    tx.workoutSession.findUnique.mockResolvedValue(s);
    withP(tx, p, ch);
    await service.syncSession(tx, 's1');
    expect(tx.challengeActivity.createMany).not.toHaveBeenCalled();
    expect(tx.challengeActivity.deleteMany).toHaveBeenCalledWith({ where: { participantId: 'p1', workoutSessionId: 's1' } });
  });

  it('la fecha se evalúa en la zona de la usuaria (noche del último día en Bogotá)', async () => {
    const { service, tx } = setup();
    // 01:00 UTC del 1 de octubre = 20:00 del 30 de septiembre en Bogotá → todavía cuenta.
    tx.workoutSession.findUnique.mockResolvedValue(session({ completedAt: at('2026-10-01T01:00:00Z') }));
    withP(tx);
    await service.syncSession(tx, 's1');
    expect(tx.challengeActivity.createMany).toHaveBeenCalled();
  });

  it('al llegar a la meta pasa a COMPLETED y avisa una sola vez', async () => {
    const { service, tx, notifications } = setup();
    tx.workoutSession.findUnique.mockResolvedValue(session());
    withP(tx, { progress: 2 }, { goal: 3 });
    tx.challengeActivity.aggregate.mockResolvedValue({ _sum: { contribution: 3 } });
    await service.syncSession(tx, 's1');
    expect(tx.challengeParticipant.update.mock.calls[0][0].data).toEqual({ progress: 3, status: 'COMPLETED' });
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', type: 'CHALLENGE_COMPLETED' }), tx);

    notifications.notify.mockClear();
    tx.challengeParticipant.update.mockClear();
    withP(tx, { progress: 3, status: 'COMPLETED' }, { goal: 3 });
    await service.syncSession(tx, 's1'); // reintento: sin cambios
    expect(tx.challengeParticipant.update).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('si una sesión deja de ser válida, el reto completado vuelve a en curso', async () => {
    const { service, tx, notifications } = setup();
    tx.workoutSession.findUnique.mockResolvedValue(session({ status: 'SKIPPED' }));
    withP(tx, { progress: 3, status: 'COMPLETED' }, { goal: 3 });
    tx.challengeActivity.aggregate.mockResolvedValue({ _sum: { contribution: 2 } });
    await service.syncSession(tx, 's1');
    expect(tx.challengeParticipant.update.mock.calls[0][0].data).toEqual({ progress: 2, status: 'IN_PROGRESS' });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('solo considera retos publicados y en los que no abandonó', async () => {
    const { service, tx } = setup();
    tx.workoutSession.findUnique.mockResolvedValue(session());
    await service.syncSession(tx, 's1');
    expect(tx.challengeParticipant.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1', status: { not: 'ABANDONED' }, challenge: { isActive: true } });
  });

  it('una sesión inexistente no hace nada', async () => {
    const { service, tx } = setup();
    tx.workoutSession.findUnique.mockResolvedValue(null);
    await service.syncSession(tx, 'nope');
    expect(tx.challengeParticipant.findMany).not.toHaveBeenCalled();
  });
});
