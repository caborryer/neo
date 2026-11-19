import type { ChartPointDto } from '@neo/shared-types';

/**
 * Barras de entrenamientos completados frente a programados por período (día o semana).
 * SVG simple y accesible: la tabla oculta ofrece los mismos datos a lectores de pantalla.
 */
export function AdherenceChart({ points }: { points: ChartPointDto[] }) {
  const W = 560;
  const H = 180;
  const PAD = { top: 12, right: 8, bottom: 26, left: 28 };
  const max = Math.max(1, ...points.map((p) => p.scheduled));
  const slot = (W - PAD.left - PAD.right) / Math.max(1, points.length);
  const bar = Math.min(34, slot * 0.7);
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / max);
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Entrenamientos completados y programados por período" className="h-auto w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-neo-border" strokeDasharray={t === 0 ? undefined : '3 3'} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="fill-neo-muted text-[10px]">{t}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = PAD.left + slot * i + (slot - bar) / 2;
          return (
            <g key={p.date}>
              <rect x={x} y={y(p.scheduled)} width={bar} height={y(0) - y(p.scheduled)} rx={3} className="fill-neo-pink-light" />
              <rect x={x} y={y(p.completed)} width={bar} height={y(0) - y(p.completed)} rx={3} className="fill-neo-primary" />
              <text x={x + bar / 2} y={H - 8} textAnchor="middle" className="fill-neo-muted text-[10px]">{p.label}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex items-center gap-4 text-xs text-neo-muted">
        <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-neo-primary" aria-hidden="true" /> Completados</span>
        <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-neo-pink-light" aria-hidden="true" /> Programados</span>
      </figcaption>
      <table className="sr-only">
        <caption>Adherencia por período</caption>
        <thead><tr><th>Desde</th><th>Programados</th><th>Completados</th><th>Adherencia</th></tr></thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}><td>{p.date}</td><td>{p.scheduled}</td><td>{p.completed}</td><td>{p.adherence === null ? 'sin datos' : `${p.adherence}%`}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
