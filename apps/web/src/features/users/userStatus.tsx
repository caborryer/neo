import { CheckCircle2, Clock, PauseCircle, XCircle } from 'lucide-react';
import { UserStatus } from '@neo/shared-types';
import { AppBadge } from '@/components/ui/AppBadge';

export const STATUS_LABEL: Record<UserStatus, string> = {
  [UserStatus.PENDING]: 'Pendiente',
  [UserStatus.ACTIVE]: 'Activa',
  [UserStatus.SUSPENDED]: 'Suspendida',
  [UserStatus.INACTIVE]: 'Inactiva',
};

/** El estado se comunica con texto + icono, nunca solo con color (§3.2). */
export function StatusBadge({ status }: { status: UserStatus }) {
  const icon = {
    [UserStatus.PENDING]: <Clock className="size-3" aria-hidden="true" />,
    [UserStatus.ACTIVE]: <CheckCircle2 className="size-3" aria-hidden="true" />,
    [UserStatus.SUSPENDED]: <PauseCircle className="size-3" aria-hidden="true" />,
    [UserStatus.INACTIVE]: <XCircle className="size-3" aria-hidden="true" />,
  }[status];
  const tone = {
    [UserStatus.PENDING]: 'info',
    [UserStatus.ACTIVE]: 'success',
    [UserStatus.SUSPENDED]: 'warning',
    [UserStatus.INACTIVE]: 'neutral',
  }[status] as 'info' | 'success' | 'warning' | 'neutral';
  return (
    <AppBadge tone={tone} icon={icon}>
      {STATUS_LABEL[status]}
    </AppBadge>
  );
}

/** ¿El acceso ya venció aunque el estado siga Activa? (HU-07) */
export const isExpired = (accessExpiresAt: string | null): boolean => !!accessExpiresAt && new Date(accessExpiresAt).getTime() <= Date.now();
