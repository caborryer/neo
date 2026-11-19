import { CheckCircle2, CircleDashed, Clock, MinusCircle, XCircle } from 'lucide-react';
import { WorkoutAssignmentStatus, WorkoutCategory, WorkoutDifficulty } from '@neo/shared-types';
import { AppBadge } from '@/components/ui/AppBadge';
import { todayKey } from '@/utils/calendar';

export const DIFFICULTY_LABEL: Record<WorkoutDifficulty, string> = {
  [WorkoutDifficulty.BEGINNER]: 'Principiante',
  [WorkoutDifficulty.INTERMEDIATE]: 'Intermedio',
  [WorkoutDifficulty.ADVANCED]: 'Avanzado',
};

export const CATEGORY_LABEL: Record<WorkoutCategory, string> = {
  [WorkoutCategory.FULL_BODY]: 'Cuerpo completo',
  [WorkoutCategory.UPPER_BODY]: 'Tren superior',
  [WorkoutCategory.LOWER_BODY]: 'Tren inferior',
  [WorkoutCategory.CORE]: 'Core',
  [WorkoutCategory.CARDIO]: 'Cardio',
  [WorkoutCategory.YOGA]: 'Yoga',
  [WorkoutCategory.STRETCHING]: 'Estiramiento',
  [WorkoutCategory.OTHER]: 'Otra',
};

export const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/** Estado visible de una asignación. Una programada con fecha pasada se muestra como "Sin completar". */
export function statusView(status: WorkoutAssignmentStatus, scheduledDate: string): { label: string; tone: Tone; icon: typeof Clock } {
  switch (status) {
    case WorkoutAssignmentStatus.SCHEDULED:
      return scheduledDate < todayKey()
        ? { label: 'Sin completar', tone: 'warning', icon: Clock }
        : { label: 'Programada', tone: 'info', icon: CircleDashed };
    case WorkoutAssignmentStatus.IN_PROGRESS:
      return { label: 'En curso', tone: 'info', icon: CircleDashed };
    case WorkoutAssignmentStatus.COMPLETED:
      return { label: 'Completada', tone: 'success', icon: CheckCircle2 };
    case WorkoutAssignmentStatus.PARTIAL:
      return { label: 'Parcial', tone: 'warning', icon: MinusCircle };
    case WorkoutAssignmentStatus.SKIPPED:
      return { label: 'No realizada', tone: 'neutral', icon: XCircle };
    case WorkoutAssignmentStatus.CANCELLED:
      return { label: 'Cancelada', tone: 'neutral', icon: XCircle };
  }
}

/** Texto + icono: el estado nunca depende solo del color (§3.2). */
export function AssignmentStatusBadge({ status, scheduledDate }: { status: WorkoutAssignmentStatus; scheduledDate: string }) {
  const v = statusView(status, scheduledDate);
  const Icon = v.icon;
  return (
    <AppBadge tone={v.tone} icon={<Icon className="size-3" aria-hidden="true" />}>
      {v.label}
    </AppBadge>
  );
}
