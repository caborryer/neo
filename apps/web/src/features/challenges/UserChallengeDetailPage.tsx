import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ApiError } from '@/services/apiClient';
import { userRoutes } from '@/app/routes';
import { challengesApi } from './challengesApi';
import { ParticipationBadge, PhaseBadge, fmtRange } from './labels';

function Progress({ challengeId, goal }: { challengeId: string; goal: number }) {
  const { data, isPending, isError } = useQuery({ queryKey: ['challenge-progress', challengeId], queryFn: () => challengesApi.progress(challengeId) });
  if (isPending) return <SkeletonLoader lines={3} />;
  if (isError) return <p role="alert" className="text-sm text-red-700">No pudimos cargar tu progreso.</p>;
  const done = Math.min(data.progress, goal);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <ParticipationBadge status={data.status} />
        <span className="text-lg font-semibold tabular-nums">{done} de {goal} sesiones</span>
      </div>
      <ProgressBar value={data.progress} max={goal} label="Tu progreso en el reto" />
      {data.status === 'COMPLETED' && <p role="status" className="text-sm font-medium text-neo-green">¡Completaste el reto! 🎉</p>}
      {data.activities.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm">Sesiones que cuentan</h3>
          <ul className="flex flex-col divide-y divide-neo-border text-sm">
            {data.activities.map((a) => (
              <li key={a.sessionId} className="flex justify-between gap-2 py-2">
                <span>{a.workoutTitle}</span>
                <span className="text-neo-muted">{new Date(a.completedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function UserChallengeDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['challenge', id], queryFn: () => challengesApi.get(id!), enabled: !!id });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['challenge', id] }),
      queryClient.invalidateQueries({ queryKey: ['challenges'] }),
      queryClient.invalidateQueries({ queryKey: ['challenge-progress', id] }),
    ]);
  };
  const onError = (e: unknown) => setActionError(e instanceof ApiError && e.statusCode < 500 ? e.message : 'No pudimos completar la acción. Intenta de nuevo.');
  const join = useMutation({ mutationFn: () => challengesApi.join(id!), onSuccess: refresh, onError });
  const leave = useMutation({ mutationFn: () => challengesApi.leave(id!), onSuccess: refresh, onError });

  const joined = data?.my && data.my.status !== 'ABANDONED';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link to={userRoutes.challenges} className="inline-flex items-center gap-1 text-sm font-medium text-neo-primary-dark hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Retos
      </Link>
      {isPending ? (
        <AppCard><SkeletonLoader lines={6} /></AppCard>
      ) : error ? (
        error instanceof ApiError && error.statusCode === 404 ? <ErrorState message="No encontramos ese reto." /> : <ErrorState message="No pudimos cargar el reto." onRetry={() => void refetch()} />
      ) : (
        <>
          <div>
            <div className="flex flex-wrap items-center gap-2"><PhaseBadge phase={data.phase} /></div>
            <h1 className="mt-2">{data.name}</h1>
            <p className="mt-1 text-sm text-neo-muted">{data.category} · {fmtRange(data.startDate, data.endDate)}</p>
          </div>
          {data.description && <AppCard><p className="whitespace-pre-line">{data.description}</p></AppCard>}
          <AppCard>
            <p className="mb-3">Meta: completar <strong>{data.goal}</strong> entrenamientos. Cuentan los entrenamientos que completes después de inscribirte y dentro de las fechas del reto.</p>
            {joined ? (
              <>
                <Progress challengeId={data.id} goal={data.goal} />
                {data.my?.status === 'IN_PROGRESS' && (
                  <div className="mt-4 flex justify-end">
                    <AppButton variant="ghost" loading={leave.isPending} onClick={() => { setActionError(null); leave.mutate(); }}>Abandonar reto</AppButton>
                  </div>
                )}
              </>
            ) : data.phase === 'ENDED' ? (
              <p className="text-sm text-neo-muted">Este reto ya terminó.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.my?.status === 'ABANDONED' && <p className="text-sm text-neo-muted">Abandonaste este reto. Puedes volver a inscribirte y conservar tu avance.</p>}
                <AppButton loading={join.isPending} onClick={() => { setActionError(null); join.mutate(); }}>{data.my ? 'Volver a inscribirme' : 'Inscribirme'}</AppButton>
              </div>
            )}
            {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
          </AppCard>
        </>
      )}
    </div>
  );
}
