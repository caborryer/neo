import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ApiError } from '@/services/apiClient';
import { coachRoutes } from '@/app/routes';
import { coachChallengesApi } from './challengesApi';
import { ParticipationBadge, PhaseBadge, fmtRange } from './labels';

/** C08: avance de cada participante del reto. */
export function CoachChallengeDetailPage() {
  const { id } = useParams();
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['coach-challenge', id], queryFn: () => coachChallengesApi.get(id!), enabled: !!id });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link to={coachRoutes.challenges} className="inline-flex items-center gap-1 text-sm font-medium text-neo-primary-dark hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Retos
      </Link>
      {isPending ? (
        <AppCard><SkeletonLoader lines={6} /></AppCard>
      ) : error ? (
        error instanceof ApiError && error.statusCode === 404 ? <ErrorState message="No encontramos ese reto." /> : <ErrorState message="No pudimos cargar el reto." onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1>{data.name}</h1>
              <p className="mt-1 text-sm text-neo-muted">{data.category} · {fmtRange(data.startDate, data.endDate)} · Meta: {data.goal} sesiones</p>
            </div>
            <div className="flex items-center gap-2">
              <AppBadge tone={data.published ? 'success' : 'neutral'}>{data.published ? 'Publicado' : 'Borrador'}</AppBadge>
              <PhaseBadge phase={data.phase} />
              <Link to={coachRoutes.challengeEdit(data.id)}><AppButton variant="secondary">Editar</AppButton></Link>
            </div>
          </div>
          {data.description && <AppCard><p className="whitespace-pre-line">{data.description}</p></AppCard>}
          <AppCard>
            <h2 className="mb-3 text-lg">Participantes ({data.participantCount})</h2>
            {data.participants.length === 0 ? (
              <EmptyState title="Aún no hay participantes" description={data.published ? 'Cuando una usuaria se inscriba, verás aquí su avance.' : 'Publica el reto para que las usuarias puedan inscribirse.'} />
            ) : (
              <ul className="flex flex-col divide-y divide-neo-border">
                {data.participants.map((p) => (
                  <li key={p.userId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <Link to={coachRoutes.user(p.userId)} className="font-medium hover:underline">{p.name}</Link>
                      <ParticipationBadge status={p.status} />
                    </div>
                    <div className="flex items-center gap-3 sm:w-64">
                      <ProgressBar value={p.progress} max={data.goal} label={`Progreso de ${p.name}`} className="flex-1" />
                      <span className="w-16 text-right text-sm tabular-nums">{Math.min(p.progress, data.goal)} / {data.goal}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AppCard>
        </>
      )}
    </div>
  );
}
