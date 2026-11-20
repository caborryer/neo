import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';

const me: any = { id: 'u1', role: 'USER' };
const coach: any = { id: 'c1', role: 'COACH' };
const row = (over: object = {}) => ({ id: 'm1', body: 'hola', senderId: 'u1', readAt: null, createdAt: new Date('2026-11-19T10:00:00Z'), ...over });

function setup() {
  const prisma: any = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    message: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    notification: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
  };
  const notifications: any = { notify: jest.fn() };
  return { service: new MessagesService(prisma, notifications), prisma, notifications };
}

describe('MessagesService · usuaria', () => {
  it('no puede escribir si no tiene Coach asignada', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ coachId: null, firstName: 'Ana', lastName: 'R' });
    await expect(service.sendAsUser(me, { body: 'hola' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('escribe siempre en SU hilo, marca el mensaje como propio y avisa a la Coach', async () => {
    const { service, prisma, notifications } = setup();
    prisma.user.findUnique.mockResolvedValue({ coachId: 'c1', firstName: 'Ana', lastName: 'Ruiz' });
    prisma.message.create.mockResolvedValue(row());
    const dto = await service.sendAsUser(me, { body: 'hola' });
    expect(prisma.message.create.mock.calls[0][0].data).toEqual({ threadUserId: 'u1', senderId: 'u1', body: 'hola' });
    expect(dto).toMatchObject({ id: 'm1', body: 'hola', mine: true, readAt: null });
    expect(notifications.notify.mock.calls[0][0]).toMatchObject({ userId: 'c1', type: 'NEW_MESSAGE', data: { threadUserId: 'u1' }, message: 'Ana Ruiz te escribió.' });
  });

  it('no repite el aviso si el anterior de ese hilo sigue sin leer', async () => {
    const { service, prisma, notifications } = setup();
    prisma.user.findUnique.mockResolvedValue({ coachId: 'c1', firstName: 'Ana', lastName: 'Ruiz' });
    prisma.message.create.mockResolvedValue(row());
    prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
    await service.sendAsUser(me, { body: 'otra vez' });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('lista su hilo en orden cronológico e indica si hay más', async () => {
    const { service, prisma } = setup();
    prisma.message.findMany.mockResolvedValue([
      row({ id: 'm3', createdAt: new Date('2026-11-19T12:00:00Z'), senderId: 'c1' }),
      row({ id: 'm2', createdAt: new Date('2026-11-19T11:00:00Z') }),
      row({ id: 'm1' }),
    ]);
    const res = await service.listForUser(me, { limit: 2 });
    expect(prisma.message.findMany.mock.calls[0][0]).toMatchObject({ where: { threadUserId: 'u1' }, take: 3 });
    expect(res.meta.hasMore).toBe(true);
    expect(res.data.map((m) => [m.id, m.mine])).toEqual([['m2', true], ['m3', false]]);
  });

  it('rechaza un cursor que no pertenece a su hilo', async () => {
    const { service, prisma } = setup();
    prisma.message.findFirst.mockResolvedValue(null);
    await expect(service.listForUser(me, { limit: 30, before: '11111111-1111-4111-8111-111111111111' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.message.findFirst.mock.calls[0][0].where).toMatchObject({ threadUserId: 'u1' });
  });

  it('marcar leído solo toca los mensajes de la Coach en su hilo y sus avisos', async () => {
    const { service, prisma } = setup();
    expect(await service.markReadForUser(me)).toEqual({ updated: 2 });
    expect(prisma.message.updateMany.mock.calls[0][0].where).toEqual({ threadUserId: 'u1', readAt: null, sender: { role: 'COACH' } });
    expect(prisma.notification.updateMany.mock.calls[0][0].where).toMatchObject({ userId: 'u1', type: 'NEW_MESSAGE', data: { path: ['threadUserId'], equals: 'u1' } });
  });
});

describe('MessagesService · Coach', () => {
  it('solo abre hilos de usuarias activas: otro id → 404 y no escribe', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.sendAsCoach(coach, 'x', { body: 'hola' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.listForCoach(coach, 'x', { limit: 30 })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.markReadForCoach(coach, 'x')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject({ role: 'USER', status: 'ACTIVE' });
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('envía al hilo de la usuaria y le avisa a ella', async () => {
    const { service, prisma, notifications } = setup();
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', firstName: 'Ana', lastName: 'Ruiz' });
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Cata', lastName: 'Coach' });
    prisma.message.create.mockResolvedValue(row({ senderId: 'c1' }));
    const dto = await service.sendAsCoach(coach, 'u1', { body: 'hola Ana' });
    expect(prisma.message.create.mock.calls[0][0].data).toEqual({ threadUserId: 'u1', senderId: 'c1', body: 'hola Ana' });
    expect(dto.mine).toBe(true);
    expect(notifications.notify.mock.calls[0][0]).toMatchObject({ userId: 'u1', type: 'NEW_MESSAGE', message: 'Cata Coach te escribió.' });
  });

  it('marca leídos solo los mensajes de la usuaria', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', firstName: 'A', lastName: 'R' });
    await service.markReadForCoach(coach, 'u1');
    expect(prisma.message.updateMany.mock.calls[0][0].where).toEqual({ threadUserId: 'u1', readAt: null, sender: { role: 'USER' } });
    expect(prisma.notification.updateMany.mock.calls[0][0].where).toMatchObject({ userId: 'c1' });
  });

  it('lista conversaciones: con actividad primero, con no leídas y vista previa recortada', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([
      { id: 'a', firstName: 'Ana', lastName: 'A' },
      { id: 'b', firstName: 'Bea', lastName: 'B' },
      { id: 'c', firstName: 'Cami', lastName: 'C' },
    ]);
    prisma.message.findMany.mockResolvedValue([
      { threadUserId: 'a', body: 'x'.repeat(300), senderId: 'a', createdAt: new Date('2026-11-18T10:00:00Z') },
      { threadUserId: 'c', body: 'ok', senderId: 'c1', createdAt: new Date('2026-11-19T10:00:00Z') },
    ]);
    prisma.message.groupBy.mockResolvedValue([{ threadUserId: 'a', _count: { _all: 3 } }]);
    const res = await service.conversations({});
    expect(res.map((c) => c.userId)).toEqual(['c', 'a', 'b']);
    expect(res[0]).toMatchObject({ unread: 0, lastMessage: { body: 'ok', mine: true } });
    expect(res[1]!.unread).toBe(3);
    expect(res[1]!.lastMessage).toMatchObject({ mine: false });
    expect(res[1]!.lastMessage!.body).toHaveLength(120);
    expect(res[2]).toMatchObject({ lastMessage: null, unread: 0 });
  });

  it('filtra por nombre', async () => {
    const { service, prisma } = setup();
    await service.conversations({ search: 'an' });
    expect(prisma.user.findMany.mock.calls[0][0].where.OR).toHaveLength(2);
  });
});

describe('MessagesService · no leídos', () => {
  it('la usuaria cuenta solo lo que le escribió la Coach en su hilo', async () => {
    const { service, prisma } = setup();
    await service.unreadCount(me);
    expect(prisma.message.count.mock.calls[0][0].where).toEqual({ threadUserId: 'u1', readAt: null, sender: { role: 'COACH' } });
  });
  it('la Coach cuenta lo que le escribieron las usuarias', async () => {
    const { service, prisma } = setup();
    await service.unreadCount(coach);
    expect(prisma.message.count.mock.calls[0][0].where).toEqual({ readAt: null, sender: { role: 'USER' } });
  });
});
