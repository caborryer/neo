import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import type { NotificationDto } from '@neo/shared-types';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { coachRoutes, userRoutes } from '@/app/routes';
import { useSession } from '@/features/auth/SessionProvider';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import { notificationsApi } from './notificationsApi';

/** A dónde lleva cada notificación según su referencia y el rol. Si no hay referencia, a ninguna parte. */
export function targetOf(n: NotificationDto, isCoach: boolean): string | null {
  const d = n.data ?? {};
  switch (n.type) {
    case 'WORKOUT_ASSIGNED':
    case 'WORKOUT_RESCHEDULED':
    case 'WORKOUT_REMINDER':
      return typeof d.assignmentId === 'string' ? userRoutes.workout(d.assignmentId) : userRoutes.calendar;
    case 'NUTRITION_PLAN_ASSIGNED':
    case 'MEAL_REMINDER':
      return userRoutes.nutritionPlan;
    case 'MEAL_LOG_REVIEWED':
      return userRoutes.nutritionDiary;
    case 'MEAL_LOG_PENDING_REVIEW':
      return isCoach ? coachRoutes.foodReviews : null;
    case 'FEEDBACK_RECEIVED':
      return isCoach ? coachRoutes.dashboard : null;
    default:
      return null;
  }
}

/** HU-25: notificaciones internas, comunes a la usuaria y a la Coach (cada una ve solo las suyas). */
export function NotificationsPage() {
  const { user } = useSession();
  const isCoach = user?.role === 'COACH';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [page, setPage] = useState(1);

  const list = useQuery({ queryKey: ['notifications', 'list', page, onlyUnread], queryFn: () => notificationsApi.list(page, onlyUnread), placeholderData: keepPreviousData });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: refresh });
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh });

  const open = (n: NotificationDto) => {
    if (!n.readAt) markRead.mutate(n.id);
    const to = targetOf(n, !!isCoach);
    if (to) navigate(to);
  };

  const meta = list.data?.meta;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1>Notificaciones</h1>
        <AppButton variant="secondary" loading={markAll.isPending} onClick={() => markAll.mutate()}>
          <CheckCheck className="size-4" aria-hidden="true" /> Marcar todas como leídas
        </AppButton>
      </div>

      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyUnread} onChange={(e) => { setOnlyUnread(e.target.checked); setPage(1); }} className="size-4" />
        Solo no leídas
      </label>

      {list.isPending ? (
        <SkeletonLoader lines={5} />
      ) : list.error ? (
        <ErrorState message="No pudimos cargar tus notificaciones." onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState icon={<Bell className="size-8" aria-hidden="true" />} title={onlyUnread ? 'No tienes notificaciones sin leer' : 'Aún no tienes notificaciones'} description="Te avisaremos aquí cuando haya novedades." />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {list.data.data.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn('w-full rounded-neo-card border p-3 text-left transition-colors hover:bg-neo-neutral', n.readAt ? 'border-neo-border bg-neo-surface' : 'border-neo-primary bg-neo-pink-light/40')}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-medium">
                      {!n.readAt && <span className="sr-only">No leída. </span>}
                      {n.title}
                    </span>
                    <time dateTime={n.createdAt} className="shrink-0 text-xs text-neo-muted">{formatDateTime(n.createdAt)}</time>
                  </span>
                  <span className="mt-0.5 block text-sm text-neo-muted">{n.message}</span>
                </button>
              </li>
            ))}
          </ul>
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <AppButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</AppButton>
              <span>Página {meta.page} de {meta.totalPages}</span>
              <AppButton variant="secondary" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</AppButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
