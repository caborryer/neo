import type { UserRole, UserStatus } from './enums';

/** Usuario autenticado tal como lo expone GET /users/me (sin datos sensibles). */
export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  timezone: string;
  avatarUrl: string | null;
  accessExpiresAt: string | null;
  /** Cuándo aceptó la política de privacidad y el uso de fotos (HU-28). null = aún no. */
  privacyConsentAt: string | null;
}
