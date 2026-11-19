import type { UserRole, UserStatus } from '@prisma/client';

/** Usuario cargado desde la BD por el JwtAuthGuard en cada request. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  timezone: string;
  avatarAssetId: string | null;
  accessExpiresAt: Date | null;
  privacyConsentAt: Date | null;
}
