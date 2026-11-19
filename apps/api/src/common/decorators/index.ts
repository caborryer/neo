import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marca una ruta como pública (sin sesión). Por defecto todo requiere autenticación. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restringe la ruta a ciertos roles. El backend es la autoridad de permisos (§1). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user;
});
