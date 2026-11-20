import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import type { UserStatsRowDto } from '@neo/shared-types';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppSelect } from '@/components/ui/AppSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { coachRoutes } from '@/app/routes';
import { DistributionBars, WeeklyTrendChart } from './AdvancedCharts';
import { downloadCsv, toCsv } from './csv';
import { pct } from './labels';
import { statsApi } from './statsApi';

const MAX_DAYS = 366;
const PRESETS = [
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: '180', label: 'Últimos 6 meses' },
  { value: '365', label: 'Último año' },
  { value: 'custom', label: 'Personalizado' },
];

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDate(d);
};
const spanDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
const num = (n: number | null, suffix = ''): string => (n === null ? '—' : `${String(n).replace('.', ',')}${suffix}`);

type SortKey = 'userName' | 'adherence' | 'completed' | 'sessionsPerWeek' | 'mealLogs' | 'avgFeeling';
const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'userName', label: 'Usuaria' },
  { key: 'adherence', label: 'Adherencia' },
  { key: 'completed', label: 'Completados' },
  { key: 'sessionsPerWeek', label: 'Sesiones/sem.' },
  { key: 'mealLogs', label: 'Comidas' },
  { key: 'avgFeeling', label: 'Sensación (1–5)' },
];

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <AppCard className="!p-4">
      <p className="text-xs font-medium text-neo-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neo-muted">{hint}</p>}
    </AppCard>
  );
}

function sortRows(rows: UserStatsRowDto[], key: SortKey, dir: 'asc' | 'desc'): UserStatsRowDto[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'userName') return sign * a.userName.localeCompare(b.userName, 'es');
    const av = a[key];
    const bv = b[key];
    if (av === null && bv === null) return 0;
    if (av === null) return 1; // sin datos siempre al final
    if (bv === null) return -1;
    return sign * (av - bv);
  });
}

/** HU-31 · C05: estadísticas avanzadas de la Coach (tendencias, comparación por usuaria y exportación). */
export function AdvancedStatsPage() {
  const [preset, setPreset] = useState('90');
  const [customFrom, setCustomFrom] = useState(() => daysAgo(29));
  const [customTo, setCustomTo] = useState(() => daysAgo(0));
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'adherence', dir: 'asc' });

  const period = useMemo(
    () => (preset === 'custom' ? { from: customFrom, to: customTo } : { from: daysAgo(Number(preset) - 1), to: daysAgo(0) }),
    [preset, customFrom, customTo],
  );
  const periodError =
    preset !== 'custom' ? undefined
    : !customFrom || !customTo ? 'Indica ambas fechas'
    : customFrom > customTo ? 'La fecha inicial no puede ser posterior a la final'
    : spanDays(customFrom, customTo) > MAX_DAYS ? `El período no puede superar ${MAX_DAYS} días`
    : undefined;

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['coach-advanced-stats', period.from, period.to],
    queryFn: () => statsApi.advancedStatistics(period.from, period.to),
    enabled: !periodError,
  });

  const rows = useMemo(() => (data ? sortRows(data.users, sort.key, sort.dir) : []), [data, sort]);
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'userName' ? 'asc' : 'desc' }));

  const exportCsv = () => {
    if (!data) return;
    const csv = toCsv(
      ['Usuaria', 'Programados', 'Completados', 'Parciales', 'Adherencia (%)', 'Sesiones por semana', 'Registros de comida', 'Sensación promedio (1-5)', 'Último entrenamiento'],
      data.users.map((u) => [u.userName, u.scheduled, u.completed, u.partial, u.adherence, u.sessionsPerWeek, u.mealLogs, u.avgFeeling, u.lastWorkoutDate]),
    );
    downloadCsv(`neotraining-estadisticas-${data.from}_${data.to}.csv`, csv);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1>Estadísticas</h1>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <AppSelect label="Período" options={PRESETS} value={preset} onChange={(e) => setPreset(e.target.value)} />
          </div>
          {preset === 'custom' && (
            <>
              <div className="w-40"><AppInput label="Desde" type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} /></div>
              <div className="w-40"><AppInput label="Hasta" type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} /></div>
            </>
          )}
          <AppButton variant="secondary" onClick={exportCsv} disabled={!data || data.users.length === 0} aria-label="Exportar a CSV">
            <Download className="size-4" aria-hidden="true" /> Exportar CSV
          </AppButton>
        </div>
      </div>
      {periodError && <p role="alert" className="text-sm text-red-700">{periodError}</p>}

      {periodError ? null : isPending ? (
        <AppCard><SkeletonLoader lines={8} /></AppCard>
      ) : error ? (
        <ErrorState message="No pudimos cargar las estadísticas." onRetry={() => void refetch()} />
      ) : data.activeUsers === 0 ? (
        <EmptyState title="Aún no hay usuarias activas" description="Cuando tengas usuarias activas con entrenamientos y registros, verás aquí su evolución." />
      ) : (
        <>
          <p className="text-sm text-neo-muted">Del {data.from} al {data.to} ({data.days} {data.days === 1 ? 'día' : 'días'}). Lo futuro no se cuenta.</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Adherencia" value={pct(data.workouts.adherence)} hint={data.workouts.scheduled ? `${data.workouts.completed} de ${data.workouts.scheduled} completados` : 'Sin entrenamientos en el período'} />
            <Kpi label="Entrenamientos parciales" value={pct(data.workouts.partialRate)} hint={`${data.workouts.partial} en el período`} />
            <Kpi label="Sesiones por usuaria / semana" value={num(data.avgSessionsPerUserWeek)} hint={`${data.activeUsers} usuarias activas`} />
            <Kpi label="Sensación promedio" value={num(data.avgFeeling, ' / 5')} hint={`${data.feedbackCount} ${data.feedbackCount === 1 ? 'feedback' : 'feedbacks'}`} />
            <Kpi label="Comidas registradas" value={String(data.mealLogs)} hint={`${num(data.mealLogsPerWeek)} por semana en total`} />
            <Kpi label="Tiempo medio de revisión" value={num(data.avgReviewHours, ' h')} hint="Entre el registro y tu revisión" />
          </div>

          <AppCard title="Evolución semanal">
            {data.workouts.scheduled === 0 && data.mealLogs === 0 ? (
              <EmptyState title="Sin datos en este período" description="Prueba con un período más amplio." />
            ) : (
              <WeeklyTrendChart points={data.weekly} />
            )}
          </AppCard>

          <div className="grid gap-4 md:grid-cols-2">
            <AppCard title="Distribución de adherencia"><DistributionBars buckets={data.distribution} /></AppCard>
            <AppCard title="Entrenamientos más completados">
              {data.topWorkouts.length === 0 ? (
                <p className="text-sm text-neo-muted">Aún no hay entrenamientos completados.</p>
              ) : (
                <ol className="divide-y divide-neo-border text-sm">
                  {data.topWorkouts.map((w) => (
                    <li key={w.workoutId} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate font-medium">{w.title}</span>
                      <span className="shrink-0 text-neo-muted">{w.completed} de {w.scheduled} · {pct(w.adherence)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </AppCard>
          </div>

          <AppCard title="Comparación por usuaria">
            <div className="overflow-x-auto">
              <table aria-label="Comparación por usuaria" className="w-full min-w-[38rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-neo-border text-xs text-neo-muted">
                    {COLUMNS.map((c) => (
                      <th key={c.key} scope="col" className="py-2 pr-3 font-medium" aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex min-h-8 items-center gap-1 hover:text-neo-dark">
                          {c.label}{sort.key === c.key && <span aria-hidden="true">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neo-border">
                  {rows.map((u) => (
                    <tr key={u.userId}>
                      <td className="py-2 pr-3"><Link to={coachRoutes.user(u.userId)} className="font-medium text-neo-primary-dark hover:underline">{u.userName}</Link></td>
                      <td className="py-2 pr-3">{pct(u.adherence)}</td>
                      <td className="py-2 pr-3">{u.completed} de {u.scheduled}</td>
                      <td className="py-2 pr-3">{num(u.sessionsPerWeek)}</td>
                      <td className="py-2 pr-3">{u.mealLogs}</td>
                      <td className="py-2 pr-3">{num(u.avgFeeling)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AppCard>
        </>
      )}
    </div>
  );
}
