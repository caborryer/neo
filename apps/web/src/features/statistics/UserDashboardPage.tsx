import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCircle2, Utensils } from 'lucide-react';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { userRoutes } from '@/app/routes';
import { AssignmentCard } from '@/features/calendar/AssignmentCard';
import { statsApi } from './statsApi';

/** HU-16 · U01: inicio de la usuaria: avance semanal, próximo entrenamiento y estado de su alimentación. */
export function UserDashboardPage() {
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['user-dashboard'], queryFn: statsApi.userDashboard });

  if (isPending) return <AppCard><SkeletonLoader lines={5} /></AppCard>;
  if (error) return <ErrorState message="No pudimos cargar tu inicio." onRetry={() => void refetch()} />;

  const { weekly, nutrition } = data;
  const goalReached = weekly.completed >= weekly.goal;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h1>Hola, {data.firstName}</h1>
        {data.unreadNotifications > 0 && (
          <Link to={userRoutes.notifications} className="inline-flex items-center gap-1.5 rounded-full bg-neo-pink-light px-3 py-1 text-xs font-semibold text-neo-primary-dark">
            <Bell className="size-3.5" aria-hidden="true" />
            {data.unreadNotifications} {data.unreadNotifications === 1 ? 'notificación nueva' : 'notificaciones nuevas'}
          </Link>
        )}
      </div>

      <AppCard title="Tu semana">
        <p className="mb-2 text-sm">
          <span className="text-2xl font-bold">{weekly.completed}</span> de {weekly.goal} {weekly.goal === 1 ? 'entrenamiento' : 'entrenamientos'}
        </p>
        <ProgressBar value={weekly.completed} max={weekly.goal} label="Meta semanal de entrenamientos" />
        <p className="mt-2 text-xs text-neo-muted">
          {goalReached ? '¡Meta de la semana cumplida! 🎉' : `Te ${weekly.goal - weekly.completed === 1 ? 'falta 1' : `faltan ${weekly.goal - weekly.completed}`} para tu meta.`}
        </p>
        {data.todayDone && (
          <div className="mt-2">
            <AppBadge tone="success" icon={<CheckCircle2 className="size-3" aria-hidden="true" />}>Hoy ya entrenaste</AppBadge>
          </div>
        )}
      </AppCard>

      <section aria-labelledby="next-workout">
        <h2 id="next-workout" className="mb-2 text-base font-semibold">Próximo entrenamiento</h2>
        {data.next ? (
          <AssignmentCard assignment={data.next} showDate />
        ) : (
          <EmptyState
            title="No tienes entrenamientos programados"
            description="Cuando tu Coach te asigne uno, aparecerá aquí."
            action={<Link to={userRoutes.calendar} className="text-sm font-medium text-neo-primary-dark hover:underline">Ver calendario</Link>}
          />
        )}
      </section>

      <AppCard title="Alimentación">
        {nutrition.planName ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="flex items-center gap-2 font-medium"><Utensils className="size-4 text-neo-muted" aria-hidden="true" /> {nutrition.planName}</p>
            <p className="text-neo-muted">
              {nutrition.plannedMealsToday > 0
                ? `Hoy: ${nutrition.loggedToday} de ${nutrition.plannedMealsToday} comidas registradas.`
                : `Hoy no tienes comidas en tu plan. Registradas: ${nutrition.loggedToday}.`}
            </p>
            <div className="flex gap-4">
              <Link to={userRoutes.nutritionPlan} className="font-medium text-neo-primary-dark hover:underline">Ver mi plan</Link>
              <Link to={userRoutes.nutritionDiary} className="font-medium text-neo-primary-dark hover:underline">Registrar comida</Link>
            </div>
          </div>
        ) : (
          <EmptyState title="Aún no tienes un plan de alimentación" description="Tu Coach te lo asignará pronto. Mientras tanto puedes llevar tu diario." action={<Link to={userRoutes.nutritionDiary} className="text-sm font-medium text-neo-primary-dark hover:underline">Ir al diario</Link>} />
        )}
      </AppCard>
    </div>
  );
}
