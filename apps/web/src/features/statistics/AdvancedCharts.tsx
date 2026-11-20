import type { AdherenceBucketDto, WeeklyStatsPointDto } from '@neo/shared-types';

const fmtWeek = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/**
 * Tendencia semanal: línea de adherencia (0–100 %) sobre barras de registros de comida.
 * SVG accesible; la tabla oculta expone los mismos datos a lectores de pantalla.
 */
export function WeeklyTrendChart({ points }: { points: WeeklyStatsPointDto[] }) {
  const W = 640;
  const H = 200;
  const PAD = { top: 12, right: 30, bottom: 26, left: 30 };
  const maxMeals = Math.max(1, ...points.map((p) => p.mealLogs));
  const slot = (W - PAD.left - PAD.right) / Math.max(1, points.length);
  const bar = Math.min(28, slot * 0.6);
  const plotH = H - PAD.top - PAD.bottom;
  const yPct = (v: number) => PAD.top + plotH * (1 - v / 100);
  const yMeal = (v: number) => PAD.top + plotH * (1 - v / maxMeals);
  const cx = (i: number) => PAD.left + slot * i + slot / 2;
  const withData = points.map((p, i) => ({ p, i })).filter(({ p }) => p.adherence !== null);
  const path = withData.map(({ p, i }, k) => `${k === 0 ? 'M' : 'L'}${cx(i)},${yPct(p.adherence!)}`).join(' ');
  const labelEvery = Math.ceil(points.length / 12);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Adherencia semanal y registros de comida por semana" className="h-auto w-full">
        {[0, 50, 100].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yPct(t)} y2={yPct(t)} className="stroke-neo-border" strokeDasharray={t === 0 ? undefined : '3 3'} />
            <text x={PAD.left - 6} y={yPct(t) + 4} textAnchor="end" className="fill-neo-muted text-[10px]">{t}%</text>
          </g>
        ))}
        <text x={W - PAD.right + 6} y={yMeal(maxMeals) + 4} className="fill-neo-muted text-[10px]">{maxMeals}</text>
        {points.map((p, i) => (
          <g key={p.weekStart}>
            <rect x={cx(i) - bar / 2} y={yMeal(p.mealLogs)} width={bar} height={yMeal(0) - yMeal(p.mealLogs)} rx={3} className="fill-neo-pink-light" />
            {i % labelEvery === 0 && <text x={cx(i)} y={H - 8} textAnchor="middle" className="fill-neo-muted text-[10px]">{fmtWeek(p.weekStart)}</text>}
          </g>
        ))}
        {withData.length > 1 && <path d={path} fill="none" strokeWidth={2.5} strokeLinejoin="round" className="stroke-neo-primary" />}
        {withData.map(({ p, i }) => (
          <circle key={p.weekStart} cx={cx(i)} cy={yPct(p.adherence!)} r={3.5} className="fill-neo-primary" />
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap items-center gap-4 text-xs text-neo-muted">
        <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-neo-primary" aria-hidden="true" /> Adherencia (%)</span>
        <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-neo-pink-light" aria-hidden="true" /> Registros de comida</span>
        <span>Semanas desde el lunes indicado</span>
      </figcaption>
      <table className="sr-only">
        <caption>Evolución semanal</caption>
        <thead><tr><th>Semana desde</th><th>Programados</th><th>Completados</th><th>Adherencia</th><th>Registros de comida</th></tr></thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.weekStart}><td>{p.weekStart}</td><td>{p.scheduled}</td><td>{p.completed}</td><td>{p.adherence === null ? 'sin datos' : `${p.adherence}%`}</td><td>{p.mealLogs}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Barras horizontales: cuántas usuarias hay en cada tramo de adherencia. */
export function DistributionBars({ buckets }: { buckets: AdherenceBucketDto[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.users));
  return (
    <ul className="flex flex-col gap-2" aria-label="Usuarias por tramo de adherencia">
      {buckets.map((b) => (
        <li key={b.label} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2 text-sm">
          <span className="text-neo-muted">{b.label}</span>
          <span className="h-3 rounded-full bg-neo-neutral" aria-hidden="true">
            <span className="block h-3 rounded-full bg-neo-primary" style={{ width: `${(b.users / max) * 100}%` }} />
          </span>
          <span className="text-right font-medium">{b.users}</span>
        </li>
      ))}
    </ul>
  );
}
