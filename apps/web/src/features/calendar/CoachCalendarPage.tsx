import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Clock } from 'lucide-react';
import { WorkoutAssignmentStatus, UserStatus, type AssignmentDto } from '@neo/shared-types';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { usersApi } from '@/features/users/usersApi';
import { AssignmentStatusBadge, DIFFICULTY_LABEL } from '@/features/workouts/labels';
import { assignmentsApi } from '@/features/workouts/workoutsApi';
import { ApiError } from '@/services/apiClient';
import { addMonths, dayLabel, monthRange, todayKey } from '@/utils/calendar';
import { AssignModal } from './AssignModal';
import { MonthCalendar } from './MonthCalendar';
import { RescheduleModal } from './RescheduleModal';
import { coachRoutes } from '@/app/routes';

export function CoachCalendarPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(todayKey());
  const [userId, setUserId] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState<AssignmentDto | null>(null);
  const [cancelling, setCancelling] = useState<AssignmentDto | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const range = monthRange(month.getFullYear(), month.getMonth());
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['assignments', 'coach', range, userId],
    queryFn: () => assignmentsApi.list({ ...range, userId: userId || undefined }),
  });
  const users = useQuery({
    queryKey: ['users', 'options'],
    queryFn: () => usersApi.list({ page: 1, limit: 100, status: UserStatus.ACTIVE, sortBy: 'firstName', sortOrder: 'asc' }),
    staleTime: 60_000,
  });

  const { counts, highlight, byDate } = useMemo(() => {
    const counts: Record<string, number> = {};
    const highlight: Record<string, boolean> = {};
    const byDate: Record<string, AssignmentDto[]> = {};
    for (const a of data ?? []) {
      if (a.status === WorkoutAssignmentStatus.CANCELLED) continue;
      counts[a.scheduledDate] = (counts[a.scheduledDate] ?? 0) + 1;
      (byDate[a.scheduledDate] ??= []).push(a);
      if (a.status === WorkoutAssignmentStatus.SCHEDULED && a.scheduledDate < todayKey()) highlight[a.scheduledDate] = true;
    }
    return { counts, highlight, byDate };
  }, [data]);

  const cancelled = (data ?? []).filter((a) => a.status === WorkoutAssignmentStatus.CANCELLED && a.scheduledDate === selected);
  const dayItems = [...(byDate[selected] ?? []), ...cancelled];

  const cancel = useMutation({
    mutationFn: (id: string) => assignmentsApi.update(id, { status: 'CANCELLED' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setCancelling(null);
    },
    onError: (err) => setCancelError(err instanceof ApiError && err.statusCode < 500 ? err.message : 'No pudimos cancelar. Intenta de nuevo.'),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Calendario</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filtrar por usuaria"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm"
          >
            <option value="">Todas las usuarias</option>
            {users.data?.data.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
          <AppButton onClick={() => setAssignOpen(true)}>
            <CalendarPlus className="size-4" aria-hidden="true" /> Asignar clase
          </AppButton>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <AppCard>
          <MonthCalendar
            month={month}
            selected={selected}
            onSelect={setSelected}
            onMonthChange={(d) => setMonth((m) => addMonths(m, d))}
            counts={counts}
            highlight={highlight}
          />
          <p className="mt-3 text-xs text-neo-muted">El punto ámbar marca días con entrenamientos programados sin completar.</p>
        </AppCard>

        <AppCard title={dayLabel(selected)}>
          {isPending ? (
            <SkeletonLoader lines={3} />
          ) : isError ? (
            <ErrorState message="No pudimos cargar el calendario." onRetry={() => void refetch()} />
          ) : dayItems.length === 0 ? (
            <EmptyState
              title="Sin entrenamientos este día"
              description="Asigna una clase a una o varias usuarias."
              action={<AppButton onClick={() => setAssignOpen(true)}>Asignar clase</AppButton>}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-neo-border">
              {dayItems.map((a) => (
                <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{a.workout.title}</p>
                    <p className="flex flex-wrap items-center gap-x-3 text-xs text-neo-muted">
                      <Link to={coachRoutes.user(a.user.id)} className="font-medium text-neo-primary-dark hover:underline">
                        {a.user.firstName} {a.user.lastName}
                      </Link>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden="true" /> {a.scheduledTime ?? 'Sin hora'} · {a.workout.durationMinutes} min
                      </span>
                      <span>{DIFFICULTY_LABEL[a.workout.difficulty]}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AssignmentStatusBadge status={a.status} scheduledDate={a.scheduledDate} />
                    {a.status === WorkoutAssignmentStatus.SCHEDULED && (
                      <>
                        <AppButton variant="secondary" onClick={() => setRescheduling(a)} aria-label={`Reprogramar ${a.workout.title} de ${a.user.firstName}`}>
                          Reprogramar
                        </AppButton>
                        <AppButton
                          variant="ghost"
                          onClick={() => {
                            setCancelError(null);
                            setCancelling(a);
                          }}
                          aria-label={`Cancelar ${a.workout.title} de ${a.user.firstName}`}
                        >
                          Cancelar
                        </AppButton>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AppCard>
      </div>

      {assignOpen && <AssignModal defaultDate={selected} defaultUserId={userId} onClose={() => setAssignOpen(false)} />}
      {rescheduling && <RescheduleModal assignment={rescheduling} onClose={() => setRescheduling(null)} />}
      <Modal open={!!cancelling} title="Cancelar entrenamiento" onClose={() => setCancelling(null)}>
        {cancelling && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              ¿Cancelar <strong>{cancelling.workout.title}</strong> de {cancelling.user.firstName} {cancelling.user.lastName} el {dayLabel(cancelling.scheduledDate).toLowerCase()}? La usuaria dejará de verlo y no cuenta como pendiente.
            </p>
            {cancelError && (
              <p role="alert" className="rounded-neo-input bg-red-50 px-3 py-2 text-sm text-red-900">
                {cancelError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <AppButton variant="secondary" onClick={() => setCancelling(null)}>
                Volver
              </AppButton>
              <AppButton variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate(cancelling.id)}>
                Cancelar entrenamiento
              </AppButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
