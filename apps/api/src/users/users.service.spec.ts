import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersService } from './users.service';

function setup() {
  const tx: any = {
    user: { create: jest.fn().mockResolvedValue({ id: 'u1', email: 'ana@mail.com', firstName: 'Ana' }) },
    userAccessEvent: { create: jest.fn() },
  };
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
  };
  const audit: any = { record: jest.fn() };
  const tokens: any = { issue: jest.fn().mockResolvedValue('inv-token') };
  const mail: any = { sendInvitation: jest.fn().mockResolvedValue(true) };
  return { service: new UsersService(prisma, audit, tokens, mail), prisma, tx, audit, tokens, mail };
}
const input = { firstName: 'Ana', lastName: 'Ruiz', email: 'ana@mail.com', timezone: 'America/Bogota' } as any;

describe('UsersService.create (HU-05)', () => {
  it('crea en estado PENDING vinculada a la Coach, con evento, auditoría e invitación', async () => {
    const { service, tx, audit, tokens, mail } = setup();
    const res = await service.create('coach1', input);
    const data = tx.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'PENDING', role: 'USER', coachId: 'coach1' });
    expect(data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(tx.userAccessEvent.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_CREATED' }), tx);
    expect(tokens.issue).toHaveBeenCalledWith('u1', 'INVITATION', tx);
    expect(mail.sendInvitation).toHaveBeenCalledWith('ana@mail.com', 'Ana', 'inv-token');
    expect(res.invitationSent).toBe(true);
  });

  it('correo duplicado → 409 sin crear nada', async () => {
    const { service, prisma, tx } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: 'otra' });
    await expect(service.create('coach1', input)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('carrera de unicidad (P2002) → 409', async () => {
    const { service, prisma } = setup();
    prisma.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    await expect(service.create('coach1', input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('si el correo falla, la usuaria igual queda creada (invitationSent=false)', async () => {
    const { service, mail } = setup();
    mail.sendInvitation.mockResolvedValue(false);
    const res = await service.create('coach1', input);
    expect(res.invitationSent).toBe(false);
    expect(res.user.id).toBe('u1');
  });
});

describe('UsersService.list', () => {
  it('filtra solo usuarias, busca sin distinguir mayúsculas y pagina', async () => {
    const { service, prisma } = setup();
    prisma.user.count.mockResolvedValue(25);
    const res = await service.list({ page: 2, limit: 10, search: 'ana', status: 'ACTIVE' as any, sortOrder: 'asc' });
    const args = prisma.user.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ role: 'USER', status: 'ACTIVE' });
    expect(args.where.OR).toHaveLength(3);
    expect(args.skip).toBe(10);
    expect(res.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
  });

  it('ordena solo por columnas permitidas', async () => {
    const { service, prisma } = setup();
    await service.list({ page: 1, limit: 10, sortBy: 'passwordHash', sortOrder: 'desc' });
    expect(prisma.user.findMany.mock.calls[0][0].orderBy[0]).toEqual({ createdAt: 'desc' });
    await service.list({ page: 1, limit: 10, sortBy: 'email', sortOrder: 'asc' });
    expect(prisma.user.findMany.mock.calls[1][0].orderBy[0]).toEqual({ email: 'asc' });
  });
});

describe('UsersService.updateProfile (HU-24)', () => {
  function profileSetup(asset: any) {
    const tx: any = { user: { update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'u1', ...data })) } };
    const prisma: any = { mediaAsset: { findFirst: jest.fn().mockResolvedValue(asset) }, $transaction: jest.fn(async (fn: any) => fn(tx)) };
    const audit: any = { record: jest.fn() };
    return { service: new UsersService(prisma, audit, {} as any, {} as any), prisma, tx, audit };
  }

  it('guarda nombre y zona horaria y audita con los campos cambiados (sin valores)', async () => {
    const { service, tx, audit } = profileSetup(null);
    await service.updateProfile('u1', { firstName: 'Ana María' });
    expect(tx.user.update.mock.calls[0][0]).toMatchObject({ where: { id: 'u1' }, data: { firstName: 'Ana María' } });
    expect(audit.record.mock.calls[0][0]).toMatchObject({ action: 'PROFILE_UPDATED', metadata: { fields: ['firstName'] } });
  });

  it('la foto debe ser una imagen propia: ajena o inexistente → 400 y no se guarda', async () => {
    const { service, prisma, tx } = profileSetup(null);
    await expect(service.updateProfile('u1', { avatarAssetId: '11111111-1111-4111-8111-111111111111' })).rejects.toThrow('foto de perfil');
    expect(prisma.mediaAsset.findFirst.mock.calls[0][0].where).toMatchObject({ ownerId: 'u1' });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('acepta una imagen propia y permite quitar la foto con null', async () => {
    const ok = profileSetup({ mimeType: 'image/png' });
    await ok.service.updateProfile('u1', { avatarAssetId: '11111111-1111-4111-8111-111111111111' });
    expect(ok.tx.user.update).toHaveBeenCalled();
    const clear = profileSetup(null);
    await clear.service.updateProfile('u1', { avatarAssetId: null });
    expect(clear.prisma.mediaAsset.findFirst).not.toHaveBeenCalled();
    expect(clear.tx.user.update.mock.calls[0][0].data).toEqual({ avatarAssetId: null });
  });
});

describe('UsersService.acceptPrivacy (HU-28)', () => {
  function consentSetup(current: any) {
    const tx: any = { user: { update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...current, ...data })) } };
    const prisma: any = { user: { findUniqueOrThrow: jest.fn().mockResolvedValue(current) }, $transaction: jest.fn(async (fn: any) => fn(tx)) };
    const audit: any = { record: jest.fn() };
    return { service: new UsersService(prisma, audit, {} as any, {} as any), tx, audit };
  }

  it('registra la fecha de aceptación y audita', async () => {
    const { service, tx, audit } = consentSetup({ id: 'u1', privacyConsentAt: null });
    const res = await service.acceptPrivacy('u1');
    expect(tx.user.update.mock.calls[0][0].data.privacyConsentAt).toBeInstanceOf(Date);
    expect(res.privacyConsentAt).toBeInstanceOf(Date);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'PRIVACY_CONSENT_ACCEPTED' }), tx);
  });

  it('es idempotente: conserva la fecha de la primera aceptación', async () => {
    const first = new Date('2026-01-01T00:00:00Z');
    const { service, tx } = consentSetup({ id: 'u1', privacyConsentAt: first });
    expect((await service.acceptPrivacy('u1')).privacyConsentAt).toBe(first);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
