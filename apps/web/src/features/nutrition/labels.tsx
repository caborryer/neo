import { CheckCircle2, CircleDashed, MessageSquareWarning, Send } from 'lucide-react';
import { DayOfWeek, FoodUnit, MealLogStatus, MealType, type AssignmentPhase } from '@neo/shared-types';
import { AppBadge } from '@/components/ui/AppBadge';
import { fromDateKey } from '@/utils/calendar';

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  [MealType.BREAKFAST]: 'Desayuno',
  [MealType.MORNING_SNACK]: 'Media mañana',
  [MealType.LUNCH]: 'Almuerzo',
  [MealType.AFTERNOON_SNACK]: 'Merienda',
  [MealType.DINNER]: 'Cena',
  [MealType.OTHER]: 'Otra comida',
};
/** Orden del día; "otra" va al final. */
export const MEAL_TYPE_ORDER: MealType[] = [
  MealType.BREAKFAST,
  MealType.MORNING_SNACK,
  MealType.LUNCH,
  MealType.AFTERNOON_SNACK,
  MealType.DINNER,
  MealType.OTHER,
];

export const FOOD_UNIT_LABEL: Record<FoodUnit, string> = {
  [FoodUnit.GRAMS]: 'g',
  [FoodUnit.MILLILITERS]: 'ml',
  [FoodUnit.UNITS]: 'unidades',
  [FoodUnit.CUPS]: 'tazas',
  [FoodUnit.TABLESPOONS]: 'cucharadas',
  [FoodUnit.TEASPOONS]: 'cucharaditas',
  [FoodUnit.SLICES]: 'rebanadas',
};

export const DAY_ORDER: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];
export const DAY_LABEL: Record<DayOfWeek, string> = {
  [DayOfWeek.MONDAY]: 'Lunes',
  [DayOfWeek.TUESDAY]: 'Martes',
  [DayOfWeek.WEDNESDAY]: 'Miércoles',
  [DayOfWeek.THURSDAY]: 'Jueves',
  [DayOfWeek.FRIDAY]: 'Viernes',
  [DayOfWeek.SATURDAY]: 'Sábado',
  [DayOfWeek.SUNDAY]: 'Domingo',
};
export const DAY_SHORT: Record<DayOfWeek, string> = {
  [DayOfWeek.MONDAY]: 'Lun',
  [DayOfWeek.TUESDAY]: 'Mar',
  [DayOfWeek.WEDNESDAY]: 'Mié',
  [DayOfWeek.THURSDAY]: 'Jue',
  [DayOfWeek.FRIDAY]: 'Vie',
  [DayOfWeek.SATURDAY]: 'Sáb',
  [DayOfWeek.SUNDAY]: 'Dom',
};

/** Día de la semana de una fecha YYYY-MM-DD. */
export const dayOfWeekOf = (dateKey: string): DayOfWeek => DAY_ORDER[(fromDateKey(dateKey).getDay() + 6) % 7]!;

export const options = <T extends string>(labels: Record<T, string>, order?: T[]) =>
  (order ?? (Object.keys(labels) as T[])).map((value) => ({ value, label: labels[value] }));

/** Cantidades sin ceros sobrantes: 50 → "50", 1.5 → "1,5". */
export const formatQuantity = (n: number): string => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const MEAL_LOG_STATUS: Record<MealLogStatus, { label: string; tone: Tone; icon: typeof Send }> = {
  [MealLogStatus.DRAFT]: { label: 'Borrador', tone: 'neutral', icon: CircleDashed },
  [MealLogStatus.SUBMITTED]: { label: 'Enviado', tone: 'info', icon: Send },
  [MealLogStatus.REVIEWED]: { label: 'Revisado', tone: 'success', icon: CheckCircle2 },
  [MealLogStatus.NEEDS_CHANGES]: { label: 'Requiere cambios', tone: 'warning', icon: MessageSquareWarning },
};

/** Texto + icono: el estado nunca depende solo del color (§3.2). */
export function MealLogStatusBadge({ status }: { status: MealLogStatus }) {
  const v = MEAL_LOG_STATUS[status];
  const Icon = v.icon;
  return (
    <AppBadge tone={v.tone} icon={<Icon className="size-3.5" aria-hidden="true" />}>
      {v.label}
    </AppBadge>
  );
}

export const PHASE_VIEW: Record<AssignmentPhase, { label: string; tone: Tone }> = {
  CURRENT: { label: 'Vigente', tone: 'success' },
  UPCOMING: { label: 'Próxima', tone: 'info' },
  PAST: { label: 'Vencida', tone: 'neutral' },
  ENDED: { label: 'Finalizada', tone: 'neutral' },
};

export function PhaseBadge({ phase }: { phase: AssignmentPhase }) {
  const v = PHASE_VIEW[phase];
  return <AppBadge tone={v.tone}>{v.label}</AppBadge>;
}
