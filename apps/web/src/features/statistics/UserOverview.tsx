import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppSelect } from '@/components/ui/AppSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { coachRoutes } from '@/app/routes';
import { assignmentsApi } from '@/features/workouts/workoutsApi';
import { AssignmentStatusBadge } from '@/features/workouts/labels';
import { PhaseBadge } from '@/features/nutrition/labels';
import { plansApi } from '@/features/nutrition/nutritionApi';
import { addDaysKey, todayInZone } from '@/utils/calendar';
import { formatDate, formatDateTime } from '@/utils/format';
import { FollowUpModal } from './FollowUpModal';
import { RANGE_OPTIONS, RISK_LABEL, pct } from './labels';
import { statsApi } from './statsApi';

/** HU-08 · HU-26 · HU-27: vista 360 de una usuaria para la Coach (adherencia, riesgo, seguimientos, entrenamientos y plan). */
export function UserOverview({ userId, userName, timezone }: { userId: string; userName: string; timezone: string }) {
  const [range, setRange] = useState('30');
  const [following, setFollowing] = useState(false);
  const stats = useQuery({ queryKey: ['user-stats', userId, range], queryFn: () => statsApi.userStatistics(userId, Number(range)) });

  const today = todayInZone(timezone);
  const from = addDaysKey(today, -14);
  const to = addDaysKey(today, 14);
  const workouts = useQuery({ queryKey: ['user-workouts-360', userId, from, to], queryFn: () => assignmentsApi.list({ userId, from, to }) });
  const plans = useQuery({ queryKey: ['user-plans-360', userId], queryFn: () => plansApi.forUser(userId) });

  return (
    <>
      <AppCard>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-semibold">Resumen</h2>
          <div className="w-44"><AppSelect label="Período" options={RANGE_OPTIONS} value={range} onChange={(e) => setRange(e.target.value)} /></div>
        </div>
        {stats.isPending ? (
          <SkeletonLoader lines={4} />
        ) : stats.error ? (
          <ErrorState message="No pudimos cargar el resumen." onRetry={() => void stats.refetch()} />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-neo-muted">Adherencia</dt>
                <dd className="mt-1 text-lg font-semibold">{pct(stats.data.adherence.adherence)}</dd>
                <dd className="text-xs text-neo-muted">
                  {stats.data.adherence.scheduled > 0 ? `${stats.data.adherence.completed} de ${stats.data.adherence.scheduled} completados` : 'Sin entrenamientos en el período'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-neo-muted">Parciales / omitidos / vencidos</dt>
                <dd className="mt-1 text-lg font-semibold">{stats.data.adherence.partial} / {stats.data.adherence.skipped} / {stats.data.adherence.missed}</dd>
              </div>
              <div>
                <dt className="text-xs text-neo-muted">Último entrenamiento</dt>
                <dd className="mt-1 text-lg font-semibold">{stats.data.lastWorkoutDate ? formatDate(`${stats.data.lastWorkoutDate}T12:00:00`) : 'Ninguno'}</dd>
              </div>
              <div>
                <dt className="text-xs text-neo-muted">Registros por revisar</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {stats.data.pendingReviews}
                  {stats.data.pendingReviews > 0 && <Link to={`${coachRoutes.foodReviews}?userId=${userId}`} className="ml-2 text-sm font-medium text-neo-primary-dark hover:underline">Revisar</Link>}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <p className="mb-1 text-xs text-neo-muted">Meta de esta semana: {stats.data.weekly.completed} de {stats.data.weekly.goal}</p>
              <ProgressBar value={stats.data.weekly.completed} max={stats.data.weekly.goal} label="Meta semanal" />
            </div>
          </>
        )}
      </AppCard>

      {stats.data && (
        <AppCard title="Alertas">
          {stats.data.risk.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-neo-green"><CheckCircle2 className="size-4" aria-hidden="true" /> Sin alertas por ahora.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {stats.data.risk.map((r) => (
                <li key={r.code} className="flex flex-wrap items-center gap-2 text-sm">
                  <AppBadge tone="warning" icon={<AlertTriangle className="size-3" aria-hidden="true" />}>{RISK_LABEL[r.code]}</AppBadge>
                  <span>{r.message}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <AppButton variant="secondary" onClick={() => setFollowing(true)}>Registrar seguimiento</AppButton>
          </div>
          {stats.data.followUps.length > 0 && (
            <ul className="mt-4 divide-y divide-neo-border border-t border-neo-border">
              {stats.data.followUps.map((f) => (
                <li key={f.id} className="py-2 text-sm">
                  <p>{f.note}</p>
                  <p className="text-xs text-neo-muted">{f.coachName} · {formatDateTime(f.createdAt)}{f.reasons.length > 0 && ` · ${f.reasons.map((r) => RISK_LABEL[r]).join(', ')}`}</p>
                </li>
              ))}
            </ul>
          )}
        </AppCard>
      )}

      <AppCard title="Entrenamientos recientes y próximos">
        {workouts.isPending ? (
          <SkeletonLoader lines={3} />
        ) : workouts.error ? (
          <ErrorState message="No pudimos cargar los entrenamientos." onRetry={() => void workouts.refetch()} />
        ) : workouts.data.length === 0 ? (
          <p className="text-sm text-neo-muted">No tiene entrenamientos entre {formatDate(`${from}T12:00:00`)} y {formatDate(`${to}T12:00:00`)}.</p>
        ) : (
          <ul className="divide-y divide-neo-border">
            {workouts.data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>{a.scheduledDate} · {a.workout.title}</span>
                <AssignmentStatusBadge status={a.status} scheduledDate={a.scheduledDate} />
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <AppCard title="Planes nutricionales">
        {plans.isPending ? (
          <SkeletonLoader lines={3} />
        ) : plans.error ? (
          <ErrorState message="No pudimos cargar los planes." onRetry={() => void plans.refetch()} />
        ) : plans.data.length === 0 ? (
          <p className="text-sm text-neo-muted">Aún no tiene planes asignados.</p>
        ) : (
          <ul className="divide-y divide-neo-border">
            {plans.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <Link to={coachRoutes.nutritionPlan(p.planId)} className="font-medium text-neo-primary-dark hover:underline">{p.planName}</Link> (v{p.versionNumber}) · {p.startDate}{p.endDate ? ` → ${p.endDate}` : ''}
                </span>
                <PhaseBadge phase={p.phase} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Link to={`${coachRoutes.foodReviews}?userId=${userId}`} className="text-sm font-medium text-neo-primary-dark hover:underline">Ver diario de alimentación</Link>
        </div>
      </AppCard>

      {following && <FollowUpModal userId={userId} userName={userName} reasons={(stats.data?.risk ?? []).map((r) => r.code)} onClose={() => setFollowing(false)} />}
    </>
  );
}
