import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { userRoutes } from '@/app/routes';
import { useSession } from './SessionProvider';
import { cn } from '@/utils/cn';

export function LogoutButton({ className, showLabel = true }: { className?: string; showLabel?: boolean }) {
  const { logout } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      aria-label={showLabel ? undefined : 'Cerrar sesión'}
      onClick={async () => {
        setBusy(true);
        await logout();
        navigate(userRoutes.login, { replace: true });
      }}
      className={cn('flex min-h-11 items-center gap-2 rounded-neo-button px-3 text-sm font-medium text-neo-dark hover:bg-neo-neutral disabled:opacity-50', className)}
    >
      <LogOut className="size-5 shrink-0" aria-hidden="true" />
      {showLabel && <span>Cerrar sesión</span>}
    </button>
  );
}
