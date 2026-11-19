import { useState } from 'react';
import type { NutritionDayDto } from '@neo/shared-types';
import type { DayOfWeek } from '@neo/shared-types';
import { cn } from '@/utils/cn';
import { DAY_LABEL, DAY_ORDER, DAY_SHORT, FOOD_UNIT_LABEL, MEAL_TYPE_LABEL, formatQuantity } from './labels';

/** Comidas de un día en solo lectura: hora, alimentos con cantidades y recomendaciones. */
export function DayMeals({ day }: { day: NutritionDayDto | undefined }) {
  if (!day || day.meals.length === 0) {
    return <p className="rounded-neo-card border border-dashed border-neo-border p-4 text-sm text-neo-muted">Sin comidas este día.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {day.meals.map((m) => (
        <li key={m.id} className="rounded-neo-card border border-neo-border bg-neo-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-base font-semibold">{m.title}</h4>
            <span className="text-xs text-neo-muted">
              {MEAL_TYPE_LABEL[m.mealType]}
              {m.scheduledTime ? ` · ${m.scheduledTime}` : ''}
            </span>
          </div>
          {m.foods.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {m.foods.map((f) => (
                <li key={f.id} className="flex justify-between gap-3 border-b border-neo-border/60 py-1 last:border-0">
                  <span>
                    {f.name}
                    {f.notes && <span className="text-neo-muted"> · {f.notes}</span>}
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatQuantity(f.quantity)} {FOOD_UNIT_LABEL[f.unit]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {m.instructions && <p className="mt-2 rounded-neo-input bg-neo-neutral p-2 text-sm">{m.instructions}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Pestañas lunes a domingo + las comidas del día elegido. */
export function WeekPlan({ days, initialDay }: { days: NutritionDayDto[]; initialDay?: DayOfWeek }) {
  const [selected, setSelected] = useState<DayOfWeek>(initialDay ?? days[0]?.dayName ?? DAY_ORDER[0]!);
  const byName = new Map(days.map((d) => [d.dayName, d]));
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Días de la semana" className="flex gap-1 overflow-x-auto">
        {DAY_ORDER.map((d) => {
          const count = byName.get(d)?.meals.length ?? 0;
          return (
            <button
              key={d}
              role="tab"
              type="button"
              aria-selected={selected === d}
              aria-label={`${DAY_LABEL[d]}${count ? `, ${count} comidas` : ', sin comidas'}`}
              onClick={() => setSelected(d)}
              className={cn(
                'min-h-11 shrink-0 rounded-neo-button px-3 text-sm font-medium',
                selected === d ? 'bg-neo-primary text-white' : 'bg-neo-neutral text-neo-dark hover:bg-neo-border',
                count === 0 && selected !== d && 'opacity-60',
              )}
            >
              {DAY_SHORT[d]}
            </button>
          );
        })}
      </div>
      <h3 className="text-base">{DAY_LABEL[selected]}</h3>
      <DayMeals day={byName.get(selected)} />
    </div>
  );
}
