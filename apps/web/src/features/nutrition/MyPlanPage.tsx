import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Utensils } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useSession } from '@/features/auth/SessionProvider';
import { userRoutes } from '@/app/routes';
import { todayInZone } from '@/utils/calendar';
import { formatDate } from '@/utils/format';
import { NutritionTabs } from './NutritionTabs';
import { WeekPlan } from './PlanDays';
import { PhaseBadge, dayOfWeekOf } from './labels';
import { myPlanApi } from './nutritionApi';

/** HU-21 · U05: la usuaria consulta su plan (solo lectura), por día, y su historial. */
export function MyPlanPage() {
  const { user } = useSession();
  // Sin la zona horaria de la usuaria no se sabe qué día es "hoy": se espera a la sesión.
  if (!user) return <AppCard><SkeletonLoader lines={6} /></AppCard>;
  return <MyPlanPageInner timezone={user.timezone} />;
}

function MyPlanPageInner({ timezone }: { timezone: string }) {
  const today = todayInZone(timezone);
  const [showHistory, setShowHistory] = useState(false);

  const plan = useQuery({ queryKey: ['my-plan', today], queryFn: () => myPlanApi.current(today) });
  const history = useQuery({ queryKey: ['my-plan', 'history'], queryFn: myPlanApi.history, enabled: showHistory });

  return (
    <div className="flex flex-col gap-4">
      <h1>Nutrición</h1>
      <NutritionTabs />

      {plan.isPending ? (
        <AppCard><SkeletonLoader lines={6} /></AppCard>
      ) : plan.isError ? (
        <ErrorState message="No pudimos cargar tu plan." onRetry={() => void plan.refetch()} />
      ) : !plan.data.current ? (
        <EmptyState
          icon={<Utensils className="size-8" aria-hidden="true" />}
          title="Aún no tienes un plan activo"
          description={
            plan.data.upcoming
              ? `Tu plan "${plan.data.upcoming.planName}" empieza el ${formatDate(plan.data.upcoming.startDate)}.`
              : 'Tu coach te asignará un plan nutricional. Mientras tanto puedes registrar lo que comes en tu diario.'
          }
          action={<Link to={userRoutes.nutritionDiary}><AppButton variant="secondary">Ir al diario</AppButton></Link>}
        />
      ) : (
        <>
          <AppCard>
            <h2 className="text-lg">{plan.data.current.planName}</h2>
            {plan.data.current.planDescription && <p className="mt-1 text-sm text-neo-muted">{plan.data.current.planDescription}</p>}
            <p className="mt-2 text-xs text-neo-muted">
              Vigencia: {formatDate(plan.data.current.startDate)} → {plan.data.current.endDate ? formatDate(plan.data.current.endDate) : 'sin fecha de fin'}
            </p>
            {plan.data.current.notes && <p className="mt-3 rounded-neo-input bg-neo-neutral p-3 text-sm">{plan.data.current.notes}</p>}
          </AppCard>
          <AppCard>
            <WeekPlan days={plan.data.current.days} initialDay={dayOfWeekOf(today)} />
          </AppCard>
          {plan.data.upcoming && (
            <p className="text-sm text-neo-muted">Próximo plan: "{plan.data.upcoming.planName}" desde el {formatDate(plan.data.upcoming.startDate)}.</p>
          )}
        </>
      )}

      <div>
        <AppButton variant="ghost" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? 'Ocultar historial de planes' : 'Ver historial de planes'}
        </AppButton>
        {showHistory && (
          <AppCard className="mt-2">
            {history.isPending ? (
              <SkeletonLoader lines={3} />
            ) : history.isError ? (
              <ErrorState message="No pudimos cargar el historial." onRetry={() => void history.refetch()} />
            ) : history.data.length === 0 ? (
              <p className="text-sm text-neo-muted">Todavía no tienes planes anteriores.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-neo-border">
                {history.data.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="text-sm font-medium">{a.planName} <span className="text-neo-muted">· v{a.versionNumber}</span></p>
                      <p className="text-xs text-neo-muted">{formatDate(a.startDate)} → {a.endDate ? formatDate(a.endDate) : 'sin fin'}</p>
                    </div>
                    <PhaseBadge phase={a.phase} />
                  </li>
                ))}
              </ul>
            )}
          </AppCard>
        )}
      </div>
    </div>
  );
}
