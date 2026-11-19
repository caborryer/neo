import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

const row = (over: object = {}) => ({ id: 'n1', userId: 'u1', type: 'WORKOUT_ASSIGNED', title: 't', message: 'm', data: { assignmentId: 'a1' }, readAt: null, createdAt: new Date('2026-11-18T10:00:00Z'), ...over });

function setup() {
  const prisma: any = {
    notification: { createMany: jest.fn(), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  };
  return { service: new NotificationsService(prisma), prisma };
}

describe('NotificationsService (HU-25)', () => {
  it('notify crea varias en una sola consulta y no hace nada con una lista vacía', async () => {
    const { service, prisma } = setup();
    await service.notify([]);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    await service.notify([{ userId: 'a', type: 'WORKOUT_ASSIGNED' as any, title: 't', message: 'm' }, { userId: 'b', type: 'WORKOUT_ASSIGNED' as any, title: 't', message: 'm' }]);
    expect(prisma.notification.createMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it('usa el cliente de la transacción cuando se lo pasan', async () => {
    const { service, prisma } = setup();
    const tx: any = { notification: { createMany: jest.fn() } };
    await service.notify({ userId: 'a', type: 'WORKOUT_ASSIGNED' as any, title: 't', message: 'm' }, tx);
    expect(tx.notification.createMany).toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('notifyCoachOf avisa a la Coach de la usuaria y reemplaza {name}', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ coachId: 'c1', firstName: 'Ana', lastName: 'Ruiz' });
    await service.notifyCoachOf('u1', { type: 'MEAL_LOG_PENDING_REVIEW' as any, title: 'Revisar', message: '{name} envió algo.' });
    expect(prisma.notification.createMany.mock.calls[0][0].data[0]).toMatchObject({ userId: 'c1', message: 'Ana Ruiz envió algo.' });
  });

  it('notifyCoachOf no hace nada si la usuaria no tiene Coach', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ coachId: null, firstName: 'A', lastName: 'B' });
    await service.notifyCoachOf('u1', { type: 'FEEDBACK_RECEIVED' as any, title: 't', message: 'm' });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('list filtra siempre por la usuaria autenticada y admite solo no leídas', async () => {
    const { service, prisma } = setup();
    prisma.notification.findMany.mockResolvedValue([row()]);
    prisma.notification.count.mockResolvedValue(1);
    const res = await service.list({ id: 'u1' } as any, { page: 1, limit: 20, unread: 'true' });
    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1', readAt: null });
    expect(res.data[0]).toMatchObject({ id: 'n1', readAt: null, createdAt: '2026-11-18T10:00:00.000Z' });
    expect(res.meta).toMatchObject({ total: 1, totalPages: 1 });
  });

  it('markRead de una ajena → 404 y no modifica nada', async () => {
    const { service, prisma } = setup();
    prisma.notification.findFirst.mockResolvedValue(null);
    await expect(service.markRead({ id: 'u1' } as any, 'n9')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.findFirst.mock.calls[0][0].where).toEqual({ id: 'n9', userId: 'u1' });
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('markRead marca la propia y es idempotente', async () => {
    const { service, prisma } = setup();
    prisma.notification.findFirst.mockResolvedValueOnce(row());
    prisma.notification.update.mockResolvedValue(row({ readAt: new Date('2026-11-18T11:00:00Z') }));
    expect((await service.markRead({ id: 'u1' } as any, 'n1')).readAt).not.toBeNull();
    prisma.notification.findFirst.mockResolvedValueOnce(row({ readAt: new Date() }));
    await service.markRead({ id: 'u1' } as any, 'n1');
    expect(prisma.notification.update).toHaveBeenCalledTimes(1);
  });

  it('markAllRead solo toca las no leídas de la usuaria; unreadCount cuenta las suyas', async () => {
    const { service, prisma } = setup();
    prisma.notification.updateMany.mockResolvedValue({ count: 4 });
    expect(await service.markAllRead('u1')).toEqual({ updated: 4 });
    expect(prisma.notification.updateMany.mock.calls[0][0].where).toEqual({ userId: 'u1', readAt: null });
    prisma.notification.count.mockResolvedValue(3);
    expect(await service.unreadCount('u1')).toEqual({ count: 3 });
  });
});
