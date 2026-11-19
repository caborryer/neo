import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildMonthGrid, monthLabel, toDateKey, todayKey, WEEKDAYS_SHORT } from '@/utils/calendar';
import { cn } from '@/utils/cn';

export interface MonthCalendarProps {
  /** Cualquier fecha del mes visible. */
  month: Date;
  selected: string;
  onSelect: (dateKey: string) => void;
  onMonthChange: (delta: -1 | 1) => void;
  /** Cantidad de elementos por día (YYYY-MM-DD → n), para el punto indicador. */
  counts: Record<string, number>;
  /** Días con elementos sin completar, resaltados. */
  highlight?: Record<string, boolean>;
}

/** Calendario mensual accesible: cada día es un botón con su fecha y cantidad como nombre accesible. */
export function MonthCalendar({ month, selected, onSelect, onMonthChange, counts, highlight = {} }: MonthCalendarProps) {
  const grid = buildMonthGrid(month.getFullYear(), month.getMonth());
  const today = todayKey();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="Mes anterior" onClick={() => onMonthChange(-1)} className="rounded-neo-button p-2 hover:bg-neo-neutral">
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <h2 aria-live="polite" className="text-base font-semibold">
          {monthLabel(month)}
        </h2>
        <button type="button" aria-label="Mes siguiente" onClick={() => onMonthChange(1)} className="rounded-neo-button p-2 hover:bg-neo-neutral">
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-neo-muted" aria-hidden="true">
        {WEEKDAYS_SHORT.map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((date) => {
          const key = toDateKey(date);
          const inMonth = date.getMonth() === month.getMonth();
          const n = counts[key] ?? 0;
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              aria-current={key === today ? 'date' : undefined}
              aria-label={`${date.getDate()} de ${new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(date)}${n ? `, ${n} entrenamiento${n > 1 ? 's' : ''}` : ''}`}
              onClick={() => onSelect(key)}
              className={cn(
                'relative flex min-h-11 flex-col items-center justify-center rounded-neo-button text-sm transition-colors',
                inMonth ? 'text-neo-dark' : 'text-neo-muted/60',
                isSelected ? 'bg-neo-primary font-semibold text-white' : 'hover:bg-neo-neutral',
                key === today && !isSelected && 'ring-1 ring-neo-primary',
              )}
            >
              {date.getDate()}
              {n > 0 && (
                <span
                  aria-hidden="true"
                  className={cn('mt-0.5 h-1.5 w-1.5 rounded-full', isSelected ? 'bg-white' : highlight[key] ? 'bg-neo-warning' : 'bg-neo-green')}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
