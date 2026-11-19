import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { userRoutes } from '@/app/routes';
import { challengesApi } from './challengesApi';
import { ParticipationBadge, PhaseBadge, fmtRange } from './labels';

/** U07 · HU-30: retos publicados y el estado de participación de la usuaria. */
export function UserChallengesPage() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['challenges'], queryFn: () => challengesApi.list({ page: 1, limit: 50 }) });

  return (
    <div className="flex flex-col gap-4">
      <h1>Retos</h1>
      {isPending ? (
        <AppCard><SkeletonLoader lines={5} /></AppCard>
      ) : isError ? (
        <ErrorState message="No pudimos cargar los retos." onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <EmptyState icon={<Trophy className="size-8" aria-hidden="true" />} title="Aún no hay retos" description="Cuando tu Coach publique uno, aparecerá aquí." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.data.map((c) => (
            <li key={c.id}>
              <Link to={userRoutes.challenge(c.id)} className="flex h-full flex-col gap-2 rounded-neo-card border border-neo-border bg-neo-surface p-4 shadow-neo-card hover:border-neo-primary">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base">{c.name}</h3>
                  <PhaseBadge phase={c.phase} />
                </div>
                <p className="text-xs text-neo-muted">{c.category} · {fmtRange(c.startDate, c.endDate)}</p>
                {c.my ? (
                  <div className="mt-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <ParticipationBadge status={c.my.status} />
                      <span className="text-sm tabular-nums">{Math.min(c.my.progress, c.goal)} / {c.goal}</span>
                    </div>
                    <ProgressBar value={c.my.progress} max={c.goal} label={`Progreso en ${c.name}`} />
                  </div>
                ) : (
                  <p className="text-sm">Meta: <strong>{c.goal}</strong> sesiones · {c.phase === 'ENDED' ? 'Terminado' : 'Toca para inscribirte'}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
