import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { notificationsApi, UNREAD_POLL_MS } from './notificationsApi';

/** Campana con el contador de no leídas. Sin push: consulta periódicamente mientras la pestaña está visible. */
export function NotificationBell({ to }: { to: string }) {
  const { data = 0 } = useQuery({ queryKey: ['notifications', 'unread'], queryFn: notificationsApi.unreadCount, refetchInterval: UNREAD_POLL_MS });
  return (
    <NavLink
      to={to}
      aria-label={data > 0 ? `Notificaciones, ${data} sin leer` : 'Notificaciones'}
      className="relative rounded-full p-2 text-neo-dark hover:bg-neo-neutral"
    >
      <Bell className="size-5" aria-hidden="true" />
      {data > 0 && (
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-neo-primary px-1 text-[10px] font-bold leading-4 text-white">
          {data > 9 ? '9+' : data}
        </span>
      )}
    </NavLink>
  );
}
