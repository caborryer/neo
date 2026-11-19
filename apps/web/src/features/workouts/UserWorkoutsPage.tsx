import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Dumbbell } from 'lucide-react';
import { WorkoutAssignmentStatus } from '@neo/shared-types';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { AssignmentCard } from '@/features/calendar/AssignmentCard';
import { userRoutes } from '@/app/routes';
import { toDateKey } from '@/utils/calendar';
import { formatDate } from '@/utils/format';
import { AssignmentStatusBadge } from './labels';
import { assignmentsApi, sessionsApi } from './workoutsApi';

/** HU-17: próximos entrenamientos (30 días) e historial de sesiones. */
export function UserWorkoutsPage() {
  const [page, setPage] = useState(1);
  const from = toDateKey(new Date());
  const to = toDateKey(new Date(Date.now() + 30 * 86_400_000));

  const upcoming = useQuery({ queryKey: ['assignments', 'me', 'upcoming', from], queryFn: () => assignmentsApi.list({ from, to, status: WorkoutAssignmentStatus.SCHEDULED }) });
  const history = useQuery({ queryKey: ['sessions', 'me', page], queryFn: () => sessionsApi.history(page), placeholderData: keepPreviousData });

  return (
    <div className="flex flex-col gap-6">
      <h1>Entrenamientos</h1>

      <section aria-labelledby="up-title" className="flex flex-col gap-3">
        <h2 id="up-title" className="text-lg">
          Próximos
        </h2>
        {upcoming.isPending ? (
          <SkeletonLoader lines={3} />
        ) : upcoming.isError ? (
          <ErrorState message="No pudimos cargar tus entrenamientos." onRetry={() => void upcoming.refetch()} />
        ) : upcoming.data.length === 0 ? (
          <EmptyState icon={<Dumbbell className="size-8" aria-hidden="true" />} title="No tienes entrenamientos programados" description="Tu Coach te asignará nuevas clases pronto." />
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.data.map((a) => (
              <li key={a.id}>
                <AssignmentCard assignment={a} showDate />
              </li>
            ))}
          </ul>
        )}
        <Link to={userRoutes.calendar} className="text-sm font-medium text-neo-primary-dark hover:underline">
          Ver calendario completo
        </Link>
      </section>

      <section aria-labelledby="hist-title" className="flex flex-col gap-3">
        <h2 id="hist-title" className="text-lg">
          Historial
        </h2>
        {history.isPending ? (
          <SkeletonLoader lines={3} />
        ) : history.isError ? (
          <ErrorState message="No pudimos cargar tu historial." onRetry={() => void history.refetch()} />
        ) : history.data.data.length === 0 ? (
          <p className="text-sm text-neo-muted">Aún no has registrado entrenamientos.</p>
        ) : (
          <AppCard className="p-0 md:p-0">
            <ul className="divide-y divide-neo-border">
              {history.data.data.map((s) => (
                <li key={s.id}>
                  <Link to={userRoutes.workout(s.assignmentId)} className="flex items-center justify-between gap-3 p-4 hover:bg-neo-neutral">
                    <div>
                      <p className="font-medium">{s.workoutTitle}</p>
                      <p className="text-xs text-neo-muted">
                        {formatDate(s.scheduledDate)}
                        {s.durationMinutes ? ` · ${s.durationMinutes} min` : ''}
                      </p>
                    </div>
                    <AssignmentStatusBadge status={s.status} scheduledDate={s.scheduledDate} />
                  </Link>
                </li>
              ))}
            </ul>
            {history.data.meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-neo-border p-3 text-sm">
                <span className="text-neo-muted">
                  Página {history.data.meta.page} de {history.data.meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <AppButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Anterior
                  </AppButton>
                  <AppButton variant="secondary" disabled={page >= history.data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Siguiente
                  </AppButton>
                </div>
              </div>
            )}
          </AppCard>
        )}
      </section>
    </div>
  );
}
