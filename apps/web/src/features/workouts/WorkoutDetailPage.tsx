import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { WorkoutAssignmentStatus } from '@neo/shared-types';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ApiError } from '@/services/apiClient';
import { userRoutes } from '@/app/routes';
import { dayLabel, todayKey } from '@/utils/calendar';
import { AssignmentStatusBadge, CATEGORY_LABEL, DIFFICULTY_LABEL } from './labels';
import { assignmentsApi, sessionsApi } from './workoutsApi';
import { YouTubePlayer } from './YouTubePlayer';

type Tab = 'description' | 'tips' | 'materials';
const TABS: { id: Tab; label: string }[] = [
  { id: 'description', label: 'Descripción' },
  { id: 'tips', label: 'Tips' },
  { id: 'materials', label: 'Materiales' },
];

/** U03 · HU-18/19: detalle con reproductor y botón para registrar la sesión. */
export function WorkoutDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('description');
  const [error, setError] = useState<string | null>(null);
  // Una sola clave por pantalla: si la petición se reintenta (red lenta, doble toque) no se duplica la sesión.
  const idempotencyKey = useRef(crypto.randomUUID());

  const { data: a, isPending, error: loadError, refetch } = useQuery({ queryKey: ['assignment', id], queryFn: () => assignmentsApi.get(id) });

  const complete = useMutation({
    mutationFn: () => sessionsApi.create({ assignmentId: id, idempotencyKey: idempotencyKey.current }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['assignment', id] }),
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
      ]);
      navigate(userRoutes.workoutFeedback(id));
    },
    onError: (err) => {
      if (err instanceof ApiError && err.statusCode === 409) void refetch();
      setError(err instanceof ApiError && err.statusCode < 500 ? err.message : 'No pudimos registrar el entrenamiento. Intenta de nuevo.');
    },
  });

  if (isPending) {
    return (
      <AppCard>
        <SkeletonLoader lines={6} />
      </AppCard>
    );
  }
  if (loadError) {
    return loadError instanceof ApiError && loadError.statusCode === 404 ? (
      <ErrorState message="No encontramos este entrenamiento." />
    ) : (
      <ErrorState message="No pudimos cargar el entrenamiento." onRetry={() => void refetch()} />
    );
  }

  const w = a.workout;
  const open = a.status === WorkoutAssignmentStatus.SCHEDULED || a.status === WorkoutAssignmentStatus.IN_PROGRESS;
  const notYet = a.scheduledDate > todayKey();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link to={userRoutes.calendar} className="inline-flex items-center gap-1 text-sm font-medium text-neo-primary-dark hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Calendario
      </Link>
      <div>
        <h1>{w.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neo-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" aria-hidden="true" /> {w.durationMinutes} min
          </span>
          <span>{DIFFICULTY_LABEL[w.difficulty]}</span>
          <span>{CATEGORY_LABEL[w.category]}</span>
          <AssignmentStatusBadge status={a.status} scheduledDate={a.scheduledDate} />
        </p>
        <p className="mt-1 text-sm text-neo-muted">{dayLabel(a.scheduledDate)}{a.scheduledTime ? ` · ${a.scheduledTime}` : ''}</p>
      </div>

      <YouTubePlayer videoId={w.videoId} title={w.title} />

      <AppCard>
        <div role="tablist" aria-label="Información de la clase" className="mb-4 flex gap-1 border-b border-neo-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`min-h-11 border-b-2 px-4 text-sm font-medium ${tab === t.id ? 'border-neo-primary text-neo-primary-dark' : 'border-transparent text-neo-muted hover:text-neo-dark'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="text-sm">
          {tab === 'description' && (w.description ? <p className="whitespace-pre-line">{w.description}</p> : <p className="text-neo-muted">Esta clase no tiene descripción.</p>)}
          {tab === 'tips' &&
            (w.tips.length ? (
              <ul className="list-disc pl-5">
                {w.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="text-neo-muted">Sin tips para esta clase.</p>
            ))}
          {tab === 'materials' &&
            (w.equipment.length ? (
              <ul className="list-disc pl-5">
                {w.equipment.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="text-neo-muted">No necesitas materiales.</p>
            ))}
        </div>
      </AppCard>

      {open ? (
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="rounded-neo-input bg-red-50 px-3 py-2 text-sm text-red-900">
              {error}
            </p>
          )}
          <AppButton fullWidth disabled={notYet} loading={complete.isPending} onClick={() => { setError(null); complete.mutate(); }}>
            <CheckCircle2 className="size-5" aria-hidden="true" /> Marcar como completada
          </AppButton>
          {notYet && <p className="text-center text-xs text-neo-muted">Podrás registrarlo el {dayLabel(a.scheduledDate).toLowerCase()}.</p>}
        </div>
      ) : a.session && !a.session.hasFeedback ? (
        <Link to={userRoutes.workoutFeedback(a.id)}>
          <AppButton fullWidth>Contarle a tu Coach cómo te fue</AppButton>
        </Link>
      ) : a.session?.hasFeedback ? (
        <p role="status" className="rounded-neo-input bg-neo-green-light px-3 py-2 text-center text-sm text-neo-green">
          Ya registraste este entrenamiento y tu retroalimentación. ¡Bien hecho!
        </p>
      ) : null}
    </div>
  );
}
