import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { WorkoutAssignmentStatus, type AssignmentDto } from '@neo/shared-types';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { assignmentsApi } from '@/features/workouts/workoutsApi';
import { addMonths, dayLabel, monthRange, todayKey } from '@/utils/calendar';
import { AssignmentCard } from './AssignmentCard';
import { MonthCalendar } from './MonthCalendar';

/** U02 · HU-17: calendario mensual con el día seleccionado y su lista de rutinas. */
export function UserCalendarPage() {
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(todayKey());
  const range = monthRange(month.getFullYear(), month.getMonth());
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['assignments', 'me', range],
    queryFn: () => assignmentsApi.list(range),
  });

  const { counts, highlight, byDate } = useMemo(() => {
    const counts: Record<string, number> = {};
    const highlight: Record<string, boolean> = {};
    const byDate: Record<string, AssignmentDto[]> = {};
    for (const a of data ?? []) {
      counts[a.scheduledDate] = (counts[a.scheduledDate] ?? 0) + 1;
      (byDate[a.scheduledDate] ??= []).push(a);
      if (a.status === WorkoutAssignmentStatus.SCHEDULED && a.scheduledDate < todayKey()) highlight[a.scheduledDate] = true;
    }
    return { counts, highlight, byDate };
  }, [data]);

  const items = byDate[selected] ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1>Calendario</h1>
      <div className="grid gap-4 md:grid-cols-[minmax(0,24rem)_1fr]">
        <AppCard>
          <MonthCalendar month={month} selected={selected} onSelect={setSelected} onMonthChange={(d) => setMonth((m) => addMonths(m, d))} counts={counts} highlight={highlight} />
        </AppCard>
        <section aria-labelledby="day-title" className="flex flex-col gap-3">
          <h2 id="day-title" className="text-base font-semibold">
            {dayLabel(selected)}
          </h2>
          {isPending ? (
            <SkeletonLoader lines={3} />
          ) : isError ? (
            <ErrorState message="No pudimos cargar tus entrenamientos." onRetry={() => void refetch()} />
          ) : items.length === 0 ? (
            <EmptyState icon={<CalendarDays className="size-8" aria-hidden="true" />} title="Sin entrenamientos este día" description="Cuando tu Coach te asigne uno, aparecerá aquí." />
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((a) => (
                <li key={a.id}>
                  <AssignmentCard assignment={a} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
