import { UserStatus } from '@neo/shared-types';

export interface AccessAction {
  target: UserStatus;
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  description: string;
}

/**
 * Acciones que la UI ofrece según el estado actual. Es solo una ayuda de navegación:
 * el backend valida cada transición (HU-06/07) y es la autoridad.
 */
export const ACCESS_ACTIONS: Record<UserStatus, AccessAction[]> = {
  [UserStatus.PENDING]: [
    { target: UserStatus.ACTIVE, label: 'Activar', variant: 'primary', description: 'La usuaria podrá iniciar sesión (normalmente se activa sola al crear su contraseña).' },
    { target: UserStatus.INACTIVE, label: 'Desactivar', variant: 'secondary', description: 'Cancela la invitación; la usuaria no podrá ingresar.' },
  ],
  [UserStatus.ACTIVE]: [
    { target: UserStatus.SUSPENDED, label: 'Suspender', variant: 'danger', description: 'Bloquea el acceso de inmediato y cierra sus sesiones. Conserva todo su historial.' },
    { target: UserStatus.INACTIVE, label: 'Desactivar', variant: 'secondary', description: 'Bloquea el acceso de forma definitiva. Conserva todo su historial.' },
  ],
  [UserStatus.SUSPENDED]: [
    { target: UserStatus.ACTIVE, label: 'Reactivar', variant: 'primary', description: 'Devuelve el acceso a la usuaria.' },
    { target: UserStatus.INACTIVE, label: 'Desactivar', variant: 'secondary', description: 'Pasa la cuenta a inactiva.' },
  ],
  [UserStatus.INACTIVE]: [
    { target: UserStatus.ACTIVE, label: 'Reactivar', variant: 'primary', description: 'Devuelve el acceso a la usuaria.' },
  ],
};
