import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/decorators';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { hasActiveAccess } from './access.util';
import { ACCESS_COOKIE, UNAVAILABLE_ACCESS_MESSAGE } from './auth.constants';

/**
 * Guard global (HU-03): exige sesión salvo rutas @Public(). Carga la usuaria desde la BD en cada
 * request, así una suspensión o expiración se aplica de inmediato (HU-06/07), sin esperar
 * a que venza el access token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    if (!token) throw new UnauthorizedException('Sesión no iniciada');

    let payload: { sub?: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub?: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        algorithms: ['HS256'], // nunca aceptar otro algoritmo (alg:none / confusión de algoritmos)
      });
    } catch {
      throw new UnauthorizedException('Sesión expirada');
    }
    if (!payload.sub) throw new UnauthorizedException('Sesión inválida');

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Sesión inválida');
    if (!hasActiveAccess(user)) throw new ForbiddenException(UNAVAILABLE_ACCESS_MESSAGE);

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      timezone: user.timezone,
      avatarAssetId: user.avatarAssetId,
      accessExpiresAt: user.accessExpiresAt,
      privacyConsentAt: user.privacyConsentAt,
    };
    return true;
  }
}
