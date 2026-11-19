import type { AdherenceDto } from '@neo/shared-types';

/** Lo mínimo que se necesita de una asignación para medir adherencia. */
export interface AssignmentFact {
  scheduledDate: string; // YYYY-MM-DD
  status: string;
}

const round = (n: number) => Math.round(n);

/** ¿Cuenta como "sin hacer"? Omitida por la usuaria o con fecha vencida sin registro. */
export function isMissedOrSkipped(a: AssignmentFact, today: string): boolean {
  return a.status === 'SKIPPED' || ((a.status === 'SCHEDULED' || a.status === 'IN_PROGRESS') && a.scheduledDate < today);
}

/** ¿Es un entrenamiento "programado válido" (§4.7)? No lo son los cancelados ni los que aún no llegan. */
export function isValidScheduled(a: AssignmentFact, today: string): boolean {
  if (a.status === 'CANCELLED') return false;
  if (a.status === 'COMPLETED' || a.status === 'PARTIAL' || a.status === 'SKIPPED') return true;
  return a.scheduledDate < today;
}

/**
 * Adherencia = completados / programados válidos × 100 (§4.7). Los parciales no suman a completados
 * y se informan aparte. `today` es la fecha de hoy en la zona horaria de la usuaria.
 */
export function computeAdherence(rows: AssignmentFact[], today: string): AdherenceDto {
  const r = { completed: 0, partial: 0, skipped: 0, missed: 0, upcoming: 0 };
  for (const a of rows) {
    if (a.status === 'CANCELLED') continue;
    if (a.status === 'COMPLETED') r.completed++;
    else if (a.status === 'PARTIAL') r.partial++;
    else if (a.status === 'SKIPPED') r.skipped++;
    else if (a.scheduledDate < today) r.missed++;
    else r.upcoming++;
  }
  const scheduled = r.completed + r.partial + r.skipped + r.missed;
  return {
    scheduled,
    ...r,
    adherence: scheduled ? round((r.completed / scheduled) * 100) : null,
    partialRate: scheduled ? round((r.partial / scheduled) * 100) : null,
  };
}

/** Suma varias adherencias (p. ej. de todas las usuarias) y recalcula los porcentajes. */
export function mergeAdherence(parts: AdherenceDto[]): AdherenceDto {
  const sum = parts.reduce(
    (acc, p) => ({
      completed: acc.completed + p.completed,
      partial: acc.partial + p.partial,
      skipped: acc.skipped + p.skipped,
      missed: acc.missed + p.missed,
      upcoming: acc.upcoming + p.upcoming,
    }),
    { completed: 0, partial: 0, skipped: 0, missed: 0, upcoming: 0 },
  );
  const scheduled = sum.completed + sum.partial + sum.skipped + sum.missed;
  return {
    scheduled,
    ...sum,
    adherence: scheduled ? round((sum.completed / scheduled) * 100) : null,
    partialRate: scheduled ? round((sum.partial / scheduled) * 100) : null,
  };
}
