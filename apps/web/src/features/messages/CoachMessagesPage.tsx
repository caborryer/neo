import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { coachRoutes } from '@/app/routes';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import { coachThread, messagesApi, THREAD_POLL_MS } from './messagesApi';
import { ThreadView } from './ThreadView';

/** HU-32 · C09: listado de conversaciones y mensajes individuales con cada usuaria. */
export function CoachMessagesPage() {
  const { userId } = useParams<{ userId: string }>();
  const [search, setSearch] = useState('');
  const list = useQuery({
    queryKey: ['messages', 'conversations', search],
    queryFn: () => messagesApi.conversations(search),
    refetchInterval: THREAD_POLL_MS,
  });
  const api = useMemo(() => (userId ? coachThread(userId) : null), [userId]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1>Mensajes</h1>
      <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
        <AppCard className={cn('md:h-[70vh] md:overflow-y-auto', userId && 'hidden md:block')}>
          <AppInput label="Buscar usuaria" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="mt-3">
            {list.isPending ? (
              <SkeletonLoader lines={4} />
            ) : list.error ? (
              <ErrorState message="No pudimos cargar las conversaciones." onRetry={() => void list.refetch()} />
            ) : list.data.length === 0 ? (
              <p className="text-sm text-neo-muted">No hay usuarias activas{search ? ' con ese nombre' : ''}.</p>
            ) : (
              <ul className="divide-y divide-neo-border" aria-label="Conversaciones">
                {list.data.map((c) => (
                  <li key={c.userId}>
                    <Link
                      to={coachRoutes.messageThread(c.userId)}
                      aria-current={c.userId === userId ? 'page' : undefined}
                      className={cn('flex flex-col gap-0.5 rounded-neo-button px-2 py-2 hover:bg-neo-neutral', c.userId === userId && 'bg-neo-pink-light')}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm', c.unread > 0 ? 'font-bold' : 'font-medium')}>{c.userName}</span>
                        {c.unread > 0 && (
                          <span aria-label={`${c.unread} sin leer`} className="min-w-5 rounded-full bg-neo-primary px-1.5 text-center text-xs font-bold text-white">{c.unread}</span>
                        )}
                      </span>
                      {c.lastMessage ? (
                        <>
                          <span className="truncate text-xs text-neo-muted">{c.lastMessage.mine ? 'Tú: ' : ''}{c.lastMessage.body}</span>
                          <span className="text-[11px] text-neo-muted">{formatDateTime(c.lastMessage.createdAt)}</span>
                        </>
                      ) : (
                        <span className="text-xs text-neo-muted">Sin mensajes</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AppCard>

        <AppCard className={cn('h-[70vh]', !userId && 'hidden md:block')}>
          {api ? (
            <>
              <Link to={coachRoutes.messages} className="mb-2 inline-block text-sm font-medium text-neo-primary-dark hover:underline md:hidden">← Conversaciones</Link>
              <ThreadView key={userId} api={api} emptyHint="Escribe el primer mensaje para iniciar la conversación." />
            </>
          ) : (
            <EmptyState title="Elige una conversación" description="Selecciona una usuaria de la lista para ver y enviar mensajes." />
          )}
        </AppCard>
      </div>
    </div>
  );
}
