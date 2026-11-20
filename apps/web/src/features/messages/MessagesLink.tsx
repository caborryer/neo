import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { BADGE_POLL_MS, messagesApi } from './messagesApi';

/** Icono de mensajes con contador de no leídos (junto a la campana). */
export function MessagesLink({ to }: { to: string }) {
  const { data = 0 } = useQuery({ queryKey: ['messages', 'unread'], queryFn: messagesApi.unreadCount, refetchInterval: BADGE_POLL_MS });
  return (
    <NavLink
      to={to}
      aria-label={data > 0 ? `Mensajes, ${data} sin leer` : 'Mensajes'}
      className="relative rounded-full p-2 text-neo-dark hover:bg-neo-neutral"
    >
      <MessageCircle className="size-5" aria-hidden="true" />
      {data > 0 && (
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-neo-primary px-1 text-[10px] font-bold leading-4 text-white">
          {data > 9 ? '9+' : data}
        </span>
      )}
    </NavLink>
  );
}
