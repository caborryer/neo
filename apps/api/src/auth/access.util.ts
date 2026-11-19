import type { User } from '@prisma/client';

/** ¿La usuaria puede usar la plataforma ahora? (HU-06/07: estado Activo y acceso vigente). */
export function hasActiveAccess(
  user: Pick<User, 'status' | 'accessExpiresAt'>,
  now: Date = new Date(),
): boolean {
  if (user.status !== 'ACTIVE') return false;
  return !user.accessExpiresAt || user.accessExpiresAt.getTime() > now.getTime();
}
