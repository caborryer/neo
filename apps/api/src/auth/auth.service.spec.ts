import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { hashToken } from './token.util';

const SECRET = 'a'.repeat(32);

function setup() {
  const tx: any = {
    refreshSession: { create: jest.fn().mockResolvedValue({ id: 'new-session' }), update: jest.fn(), updateMany: jest.fn() },
    passwordResetToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    user: { update: jest.fn() },
    userAccessEvent: { create: jest.fn() },
  };
  const prisma: any = {
    user: { findUnique: jest.fn() },
    refreshSession: { findUnique: jest.fn(), updateMany: jest.fn() },
    passwordResetToken: { findUnique: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const jwt: any = { signAsync: jest.fn().mockResolvedValue('signed.jwt') };
  const config: any = { get: (k: string) => ({ ACCESS_TOKEN_TTL_MINUTES: 15, REFRESH_TOKEN_TTL_DAYS: 14 })[k], getOrThrow: () => SECRET };
  const mail: any = { sendPasswordReset: jest.fn() };
  const audit: any = { record: jest.fn() };
  const tokens: any = { issue: jest.fn().mockResolvedValue('reset-token') };
  const service = new AuthService(prisma, jwt, config, mail, audit, tokens);
  return { service, prisma, tx, jwt, mail, audit, tokens };
}

const baseUser = async (over: object = {}) => ({
  id: 'u1',
  email: 'ana@mail.com',
  firstName: 'Ana',
  lastName: 'Ruiz',
  role: 'USER',
  status: 'ACTIVE',
  accessExpiresAt: null,
  passwordHash: await argon2.hash('Secreta123', { type: argon2.argon2id }),
  ...over,
});

describe('AuthService.login (HU-01)', () => {
  it('inicia sesión y guarda solo el hash del refresh token', async () => {
    const { service, prisma, tx } = setup();
    prisma.user.findUnique.mockResolvedValue(await baseUser());
    const { tokens } = await service.login('ana@mail.com', 'Secreta123', {});
    expect(tokens.accessToken).toBe('signed.jwt');
    const stored = tx.refreshSession.create.mock.calls[0][0].data.tokenHash;
    expect(stored).toBe(hashToken(tokens.refreshToken));
    expect(stored).not.toBe(tokens.refreshToken);
  });

  it('contraseña incorrecta y correo inexistente dan el mismo 401 genérico', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValueOnce(await baseUser());
    await expect(service.login('ana@mail.com', 'mala-clave', {})).rejects.toThrow(new UnauthorizedException('Credenciales inválidas'));
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.login('nadie@mail.com', 'Secreta123', {})).rejects.toThrow(new UnauthorizedException('Credenciales inválidas'));
  });

  it.each(['PENDING', 'SUSPENDED', 'INACTIVE'])('estado %s con contraseña correcta → 403', async (status) => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(await baseUser({ status }));
    await expect(service.login('ana@mail.com', 'Secreta123', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('acceso vencido → 403', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(await baseUser({ accessExpiresAt: new Date(Date.now() - 1000) }));
    await expect(service.login('ana@mail.com', 'Secreta123', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no revela el estado si la contraseña es incorrecta', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(await baseUser({ status: 'SUSPENDED' }));
    await expect(service.login('ana@mail.com', 'mala-clave', {})).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.refresh (rotación)', () => {
  it('rota: crea sesión nueva y revoca la anterior enlazándola', async () => {
    const { service, prisma, tx } = setup();
    prisma.refreshSession.findUnique.mockResolvedValue({
      id: 's1', userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000), user: await baseUser(),
    });
    await service.refresh('old-token', {});
    expect(tx.refreshSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { revokedAt: expect.any(Date), replacedById: 'new-session' },
    });
  });

  it('reutilizar un token ya rotado revoca todas las sesiones y responde 401', async () => {
    const { service, prisma } = setup();
    prisma.refreshSession.findUnique.mockResolvedValue({
      id: 's1', userId: 'u1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000), user: await baseUser(),
    });
    await expect(service.refresh('old-token', {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('sin cookie, token desconocido o vencido → 401', async () => {
    const { service, prisma } = setup();
    await expect(service.refresh(undefined, {})).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.refreshSession.findUnique.mockResolvedValueOnce(null);
    await expect(service.refresh('x', {})).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.refreshSession.findUnique.mockResolvedValueOnce({
      id: 's', userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() - 1), user: await baseUser(),
    });
    await expect(service.refresh('x', {})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('usuaria suspendida mientras tenía sesión → 403 y sesiones revocadas', async () => {
    const { service, prisma } = setup();
    prisma.refreshSession.findUnique.mockResolvedValue({
      id: 's1', userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000), user: await baseUser({ status: 'SUSPENDED' }),
    });
    await expect(service.refresh('t', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.refreshSession.updateMany).toHaveBeenCalled();
  });
});

describe('AuthService.forgotPassword (HU-02)', () => {
  it('no hace nada ni falla si el correo no existe', async () => {
    const { service, prisma, mail } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.forgotPassword('nadie@mail.com')).resolves.toBeUndefined();
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('envía el enlace a una usuaria existente y no a una pendiente', async () => {
    const { service, prisma, mail } = setup();
    prisma.user.findUnique.mockResolvedValueOnce(await baseUser());
    await service.forgotPassword('ana@mail.com');
    expect(mail.sendPasswordReset).toHaveBeenCalledWith('ana@mail.com', 'Ana', 'reset-token');
    mail.sendPasswordReset.mockClear();
    prisma.user.findUnique.mockResolvedValueOnce(await baseUser({ status: 'PENDING' }));
    await service.forgotPassword('ana@mail.com');
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });
});

describe('AuthService.resetPassword (HU-02)', () => {
  const record = async (over: object = {}, userOver: object = {}) => ({
    id: 't1', purpose: 'RESET', usedAt: null, expiresAt: new Date(Date.now() + 60_000), user: await baseUser(userOver), ...over,
  });

  it.each([
    ['inexistente', null],
    ['ya usado', { usedAt: new Date() }],
    ['expirado', { expiresAt: new Date(Date.now() - 1) }],
  ])('token %s → 400', async (_n, over) => {
    const { service, prisma } = setup();
    prisma.passwordResetToken.findUnique.mockResolvedValue(over === null ? null : await record(over));
    await expect(service.resetPassword('tok', 'NuevaClave1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cambia la contraseña, consume el token y cierra todas las sesiones', async () => {
    const { service, prisma, tx } = setup();
    prisma.passwordResetToken.findUnique.mockResolvedValue(await record());
    await service.resetPassword('tok', 'NuevaClave1');
    const data = tx.user.update.mock.calls[0][0].data;
    expect(await argon2.verify(data.passwordHash, 'NuevaClave1')).toBe(true);
    expect(data.status).toBeUndefined();
    expect(tx.refreshSession.updateMany).toHaveBeenCalled();
  });

  it('un token de invitación activa la cuenta y deja el evento de acceso', async () => {
    const { service, prisma, tx } = setup();
    prisma.passwordResetToken.findUnique.mockResolvedValue(await record({ purpose: 'INVITATION' }, { status: 'PENDING' }));
    await service.resetPassword('tok', 'NuevaClave1');
    expect(tx.user.update.mock.calls[0][0].data.status).toBe('ACTIVE');
    expect(tx.userAccessEvent.create.mock.calls[0][0].data).toMatchObject({ previousStatus: 'PENDING', newStatus: 'ACTIVE' });
  });

  it('si otro request consumió el token primero → 400 (sin cambiar la contraseña)', async () => {
    const { service, prisma, tx } = setup();
    prisma.passwordResetToken.findUnique.mockResolvedValue(await record());
    tx.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.resetPassword('tok', 'NuevaClave1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('AuthService.changePassword (HU-24)', () => {
  it('con la contraseña actual correcta cambia el hash, cierra las otras sesiones y conserva la actual', async () => {
    const { service, prisma, tx, audit } = setup();
    prisma.user.findUnique.mockResolvedValue(await baseUser());
    await service.changePassword('u1', 'Secreta123', 'NuevaClave456', 'mi-refresh');
    expect(tx.user.update.mock.calls[0][0].data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(tx.refreshSession.updateMany.mock.calls[0][0].where).toEqual({ userId: 'u1', revokedAt: null, tokenHash: { not: hashToken('mi-refresh') } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'PASSWORD_CHANGED' }), tx);
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('NuevaClave456');
  });

  it('sin token de sesión actual cierra todas', async () => {
    const { service, prisma, tx } = setup();
    prisma.user.findUnique.mockResolvedValue(await baseUser());
    await service.changePassword('u1', 'Secreta123', 'NuevaClave456');
    expect(tx.refreshSession.updateMany.mock.calls[0][0].where).toEqual({ userId: 'u1', revokedAt: null });
  });

  it('contraseña actual incorrecta → 400 y no cambia nada', async () => {
    const { service, prisma, tx } = setup();
    prisma.user.findUnique.mockResolvedValue(await baseUser());
    await expect(service.changePassword('u1', 'Equivocada1', 'NuevaClave456')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.refreshSession.updateMany).not.toHaveBeenCalled();
  });

  it('usuaria inexistente → 400 con el mismo mensaje', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.changePassword('x', 'a', 'NuevaClave456')).rejects.toThrow('contraseña actual');
  });
});
