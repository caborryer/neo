import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccessService } from './access.service';

function setup(user: object | null) {
  const tx: any = {
    user: { findFirst: jest.fn().mockResolvedValue(user), update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'u1', ...data })) },
    userAccessEvent: { create: jest.fn() },
    refreshSession: { updateMany: jest.fn() },
  };
  const prisma: any = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
  const audit: any = { record: jest.fn() };
  return { service: new AccessService(prisma, audit), tx, audit };
}
const u = (status: string, extra: object = {}) => ({ id: 'u1', status, accessExpiresAt: null, activatedAt: null, ...extra });

describe('AccessService.changeAccess (HU-06/07/28)', () => {
  it('suspender: actualiza, registra evento + auditoría y revoca sesiones, todo en una transacción', async () => {
    const { service, tx, audit } = setup(u('ACTIVE'));
    await service.changeAccess('coach1', 'u1', { status: 'SUSPENDED' as any, reason: 'Pago pendiente' });
    expect(tx.userAccessEvent.create.mock.calls[0][0].data).toEqual({
      userId: 'u1', changedById: 'coach1', previousStatus: 'ACTIVE', newStatus: 'SUSPENDED', reason: 'Pago pendiente',
    });
    expect(tx.refreshSession.updateMany).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_ACCESS_CHANGED' }), tx);
  });

  it('primera activación fija activatedAt; reactivar no lo pisa', async () => {
    const first = setup(u('PENDING'));
    await first.service.changeAccess('c', 'u1', { status: 'ACTIVE' as any });
    expect(first.tx.user.update.mock.calls[0][0].data.activatedAt).toBeInstanceOf(Date);
    const again = setup(u('SUSPENDED', { activatedAt: new Date('2026-01-01') }));
    await again.service.changeAccess('c', 'u1', { status: 'ACTIVE' as any });
    expect(again.tx.user.update.mock.calls[0][0].data.activatedAt).toBeUndefined();
    expect(again.tx.refreshSession.updateMany).not.toHaveBeenCalled();
  });

  it('rechaza transiciones inválidas y el mismo estado sin cambios', async () => {
    await expect(setup(u('PENDING')).service.changeAccess('c', 'u1', { status: 'SUSPENDED' as any })).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup(u('INACTIVE')).service.changeAccess('c', 'u1', { status: 'SUSPENDED' as any })).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup(u('ACTIVE')).service.changeAccess('c', 'u1', { status: 'ACTIVE' as any })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mismo estado pero nueva fecha de expiración sí se permite (extender acceso)', async () => {
    const { service, tx } = setup(u('ACTIVE'));
    const next = new Date(Date.now() + 86_400_000);
    await service.changeAccess('c', 'u1', { status: 'ACTIVE' as any, accessExpiresAt: next });
    expect(tx.user.update.mock.calls[0][0].data.accessExpiresAt).toEqual(next);
    expect(tx.userAccessEvent.create).toHaveBeenCalled();
  });

  it('no permite activar con una expiración pasada', async () => {
    const { service } = setup(u('SUSPENDED'));
    await expect(
      service.changeAccess('c', 'u1', { status: 'ACTIVE' as any, accessExpiresAt: new Date(Date.now() - 1000) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('usuaria inexistente o Coach → 404', async () => {
    await expect(setup(null).service.changeAccess('c', 'x', { status: 'ACTIVE' as any })).rejects.toBeInstanceOf(NotFoundException);
  });
});
