import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CsrfGuard } from './csrf.guard';
import { RolesGuard } from './roles.guard';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators';

const ctx = (req: any, meta: Record<string, unknown> = {}): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({ __meta: meta }),
    getClass: () => class {},
  }) as any;
const reflectorWith = (meta: Record<string, unknown>) =>
  ({ getAllAndOverride: (key: string) => meta[key] }) as unknown as Reflector;

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();
  it('permite métodos seguros sin header', () => {
    expect(guard.canActivate(ctx({ method: 'GET', header: () => undefined }))).toBe(true);
  });
  it('bloquea POST sin el header personalizado y lo permite con él', () => {
    expect(() => guard.canActivate(ctx({ method: 'POST', header: () => undefined }))).toThrow(ForbiddenException);
    expect(guard.canActivate(ctx({ method: 'POST', header: () => 'neo-web' }))).toBe(true);
  });
});

describe('RolesGuard', () => {
  it('rutas públicas o sin roles pasan', () => {
    expect(new RolesGuard(reflectorWith({ [IS_PUBLIC_KEY]: true })).canActivate(ctx({}))).toBe(true);
    expect(new RolesGuard(reflectorWith({})).canActivate(ctx({}))).toBe(true);
  });
  it('solo deja pasar al rol requerido', () => {
    const guard = new RolesGuard(reflectorWith({ [ROLES_KEY]: ['COACH'] }));
    expect(guard.canActivate(ctx({ user: { role: 'COACH' } }))).toBe(true);
    expect(() => guard.canActivate(ctx({ user: { role: 'USER' } }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx({}))).toThrow(ForbiddenException);
  });
});

describe('JwtAuthGuard', () => {
  const secret = 'a'.repeat(32);
  const jwt = new JwtService({});
  const config: any = { getOrThrow: () => secret };
  const user = (over: object = {}) => ({ id: 'u1', email: 'a@b.co', firstName: 'A', lastName: 'B', role: 'USER', status: 'ACTIVE', timezone: 'America/Bogota', avatarAssetId: null, accessExpiresAt: null, ...over });
  const build = (found: object | null) => {
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue(found) } };
    return new JwtAuthGuard(reflectorWith({}), jwt, config, prisma);
  };
  const cookie = async (sub = 'u1', opts: object = {}) => ({ cookies: { neo_at: await jwt.signAsync({ sub }, { secret, ...opts }) } });

  it('rutas públicas pasan sin cookie', async () => {
    const guard = new JwtAuthGuard(reflectorWith({ [IS_PUBLIC_KEY]: true }), jwt, config, {} as any);
    await expect(guard.canActivate(ctx({}))).resolves.toBe(true);
  });
  it('sin cookie, token inválido o expirado → 401', async () => {
    await expect(build(user()).canActivate(ctx({ cookies: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(build(user()).canActivate(ctx({ cookies: { neo_at: 'basura' } }))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(build(user()).canActivate(ctx(await cookie('u1', { expiresIn: -10 })))).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('token firmado con otro secreto → 401', async () => {
    const bad = { cookies: { neo_at: await jwt.signAsync({ sub: 'u1' }, { secret: 'z'.repeat(32) }) } };
    await expect(build(user()).canActivate(ctx(bad))).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('carga la usuaria desde la BD y la deja en request.user', async () => {
    const req: any = await cookie();
    await expect(build(user()).canActivate(ctx(req))).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: 'u1', role: 'USER' });
    expect(req.user.passwordHash).toBeUndefined();
  });
  it('una suspensión se aplica aunque el token siga vigente → 403', async () => {
    await expect(build(user({ status: 'SUSPENDED' })).canActivate(ctx(await cookie()))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build(user({ accessExpiresAt: new Date(Date.now() - 1) })).canActivate(ctx(await cookie()))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('usuaria eliminada → 401', async () => {
    await expect(build(null).canActivate(ctx(await cookie()))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
