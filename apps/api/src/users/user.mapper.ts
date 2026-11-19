import type { User } from '@prisma/client';
import type { AuthUser, UserRole, UserStatus } from '@neo/shared-types';

/** Representación pública de la usuaria autenticada: nunca incluye passwordHash. */
export function toAuthUser(user: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role' | 'status' | 'timezone' | 'accessExpiresAt' | 'avatarAssetId' | 'privacyConsentAt'>): AuthUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    // Los enums de Prisma y de shared-types tienen los mismos valores string.
    role: user.role as UserRole,
    status: user.status as UserStatus,
    timezone: user.timezone,
    avatarUrl: user.avatarAssetId ? `/api/v1/media/${user.avatarAssetId}` : null,
    privacyConsentAt: user.privacyConsentAt ? user.privacyConsentAt.toISOString() : null,
    accessExpiresAt: user.accessExpiresAt ? user.accessExpiresAt.toISOString() : null,
  };
}
