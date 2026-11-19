import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCheck, Target, TrendingUp, Users } from 'lucide-react';
import type { AtRiskUserDto } from '@neo/shared-types';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppSelect } from '@/components/ui/AppSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { coachRoutes } from '@/app/routes';
import { formatDate } from '@/utils/format';
import { AdherenceChart } from './AdherenceChart';
import { FollowUpModal } from './FollowUpModal';
import { RANGE_OPTIONS, RISK_LABEL, pct } from './labels';
import { statsApi } from './statsApi';

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <AppCard className="!p-4">
      <div className="flex items-center gap-2 text-neo-muted">
        <span aria-hidden="true">{icon}</span>
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neo-muted">{hint}</p>}
    </AppCard>
  );
}

/** HU-14 · C01: resumen de la operación de la Coach: adherencia, nutrición y usuarias que necesitan atención. */
export function CoachDashboardPage() {
  const [range, setRange] = useState('30');
  const [following, setFollowing] = useState<AtRiskUserDto | null>(null);
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['coach-dashboard', range], queryFn: () => statsApi.coachDashboard(Number(range)) });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1>Dashboard</h1>
        <div className="w-48">
          <AppSelect label="Período" options={RANGE_OPTIONS} value={range} onChange={(e) => setRange(e.target.value)} />
        </div>
      </div>

      {isPending ? (
        <AppCard><SkeletonLoader lines={6} /></AppCard>
      ) : error ? (
        <ErrorState message="No pudimos cargar el dashboard." onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={<Users className="size-4" />} label="Usuarias activas" value={String(data.activeUsers)} />
            <Kpi
              icon={<TrendingUp className="size-4" />}
              label="Adherencia"
              value={pct(data.workouts.adherence)}
              hint={data.workouts.scheduled > 0 ? `${data.workouts.completed} de ${data.workouts.scheduled} completados` : 'Sin entrenamientos en el período'}
            />
            <Kpi icon={<Target className="size-4" />} label="Metas semanales cumplidas" value={`${data.goalsMet} de ${data.activeUsers}`} hint="Esta semana" />
            <Kpi icon={<ClipboardCheck className="size-4" />} label="Entrenamientos próximos 7 días" value={String(data.upcomingWeek)} />
          </div>

          <AppCard title="Entrenamientos completados">
            {data.workouts.scheduled === 0 ? (
              <EmptyState title="Aún no hay datos" description="Cuando asignes entrenamientos y tus usuarias los completen, verás aquí la evolución." />
            ) : (
              <AdherenceChart points={data.chart} />
            )}
            {data.workouts.partial > 0 && (
              <p className="mt-2 text-xs text-neo-muted">
                Además hubo {data.workouts.partial} {data.workouts.partial === 1 ? 'entrenamiento parcial' : 'entrenamientos parciales'} ({pct(data.workouts.partialRate)}); no suman a la adherencia.
              </p>
            )}
          </AppCard>

          <AppCard title="Nutrición">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-neo-muted">Registros por revisar</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {data.nutrition.pendingReview}
                  {data.nutrition.pendingReview > 0 && (
                    <Link to={coachRoutes.foodReviews} className="ml-2 text-sm font-medium text-neo-primary-dark hover:underline">Revisar</Link>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-neo-muted">Registros enviados</dt>
                <dd className="mt-1 text-lg font-semibold">{data.nutrition.submitted}</dd>
              </div>
              <div>
                <dt className="text-xs text-neo-muted">Con plan vigente</dt>
                <dd className="mt-1 text-lg font-semibold">{data.nutrition.usersWithPlan}</dd>
              </div>
              <div>
                <dt className="text-xs text-neo-muted">Sin plan</dt>
                <dd className="mt-1 text-lg font-semibold">{data.nutrition.usersWithoutPlan}</dd>
              </div>
            </dl>
          </AppCard>

          <AppCard title="Usuarias que necesitan atención">
            {data.atRisk.length === 0 ? (
              <EmptyState title="Todo en orden" description="Ninguna usuaria activa tiene alertas en este momento." />
            ) : (
              <>
                <ul className="divide-y divide-neo-border">
                  {data.atRisk.map((u) => (
                    <li key={u.userId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <Link to={coachRoutes.user(u.userId)} className="font-medium text-neo-primary-dark hover:underline">{u.userName}</Link>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {u.reasons.map((r) => (
                            <AppBadge key={r.code} tone="warning" icon={<AlertTriangle className="size-3" aria-hidden="true" />}>{RISK_LABEL[r.code]}</AppBadge>
                          ))}
                        </div>
                        <ul className="mt-1 text-xs text-neo-muted">
                          {u.reasons.map((r) => <li key={r.code}>{r.message}</li>)}
                        </ul>
                        <p className="mt-1 text-xs text-neo-muted">{u.lastFollowUpAt ? `Último seguimiento: ${formatDate(u.lastFollowUpAt)}` : 'Sin seguimientos registrados'}</p>
                      </div>
                      <AppButton variant="secondary" onClick={() => setFollowing(u)}>Registrar seguimiento</AppButton>
                    </li>
                  ))}
                </ul>
                {data.atRiskTotal > data.atRisk.length && (
                  <p className="mt-3 text-sm text-neo-muted">
                    Y {data.atRiskTotal - data.atRisk.length} más. <Link to={coachRoutes.users} className="font-medium text-neo-primary-dark hover:underline">Ver usuarias</Link>
                  </p>
                )}
              </>
            )}
          </AppCard>
        </>
      )}

      {following && (
        <FollowUpModal
          key={following.userId}
          userId={following.userId}
          userName={following.userName}
          reasons={following.reasons.map((r) => r.code)}
          onClose={() => setFollowing(null)}
        />
      )}
    </div>
  );
}
