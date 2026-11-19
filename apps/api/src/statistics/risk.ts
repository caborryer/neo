import type { RiskReasonDto } from '@neo/shared-types';
import type { RiskSettingsInput } from '@neo/validation';
import { addDays, diffDays } from '../common/dates';
import { computeAdherence, isMissedOrSkipped, isValidScheduled, type AssignmentFact } from './adherence';

export interface RiskInput {
  /** Hoy en la zona horaria de la usuaria. */
  today: string;
  /** Desde cuándo está activa (para medir inactividad cuando nunca ha entrenado). */
  activeSince: string;
  /** Asignaciones de, al menos, las últimas 4 semanas. */
  assignments: AssignmentFact[];
  /** Inicio del plan nutricional vigente; null si no tiene plan. */
  activePlanStart: string | null;
  /** Fecha local del último registro de comida enviado; null si nunca. */
  lastMealLogDate: string | null;
}

const MIN_SAMPLE = 3;

/**
 * Alertas de riesgo (§4.8). Son indicadores de actividad, no diagnósticos: cada una trae su motivo en texto.
 * No se alerta cuando la usuaria no tenía nada asignado (no es falta suya).
 */
export function evaluateRisk(input: RiskInput, cfg: RiskSettingsInput): RiskReasonDto[] {
  const { today, assignments } = input;
  const reasons: RiskReasonDto[] = [];
  const valid = assignments.filter((a) => isValidScheduled(a, today));

  // 1) Inactividad: N días sin entrenar teniendo entrenamientos que hacer en ese lapso.
  const lastDone = valid.filter((a) => a.status === 'COMPLETED' || a.status === 'PARTIAL').map((a) => a.scheduledDate).sort().at(-1);
  const sinceActivity = diffDays(lastDone ?? input.activeSince, today);
  const hadWorkInWindow = valid.some((a) => a.scheduledDate > addDays(today, -cfg.inactivityDays));
  if (sinceActivity >= cfg.inactivityDays && hadWorkInWindow) {
    reasons.push({
      code: 'INACTIVITY',
      message: lastDone ? `Lleva ${sinceActivity} días sin entrenar` : `No ha completado ningún entrenamiento en ${sinceActivity} días`,
    });
  }

  // 2) Baja adherencia: los últimos K entrenamientos válidos, todos sin hacer.
  const lastK = [...valid].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)).slice(0, cfg.consecutiveMissed);
  if (lastK.length === cfg.consecutiveMissed && lastK.every((a) => isMissedOrSkipped(a, today))) {
    reasons.push({ code: 'CONSECUTIVE_MISSED', message: `Sus últimos ${cfg.consecutiveMissed} entrenamientos quedaron sin completar` });
  }

  // 3) Seguimiento pendiente: con plan vigente, sin enviar registros de comida.
  if (input.activePlanStart) {
    const ref = input.lastMealLogDate && input.lastMealLogDate > input.activePlanStart ? input.lastMealLogDate : input.activePlanStart;
    const days = diffDays(ref, today);
    if (days >= cfg.noFoodLogDays) {
      reasons.push({
        code: 'NO_FOOD_LOGS',
        message: input.lastMealLogDate && input.lastMealLogDate >= input.activePlanStart ? `Lleva ${days} días sin registrar comidas` : `No ha registrado comidas desde que inició su plan (${days} días)`,
      });
    }
  }

  // 4) Reducción importante: las últimas 2 semanas frente a las 2 anteriores.
  const recent = computeAdherence(assignments.filter((a) => a.scheduledDate > addDays(today, -14)), today);
  const previous = computeAdherence(assignments.filter((a) => a.scheduledDate <= addDays(today, -14) && a.scheduledDate > addDays(today, -28)), today);
  if (recent.scheduled >= MIN_SAMPLE && previous.scheduled >= MIN_SAMPLE && recent.adherence !== null && previous.adherence !== null) {
    if (previous.adherence - recent.adherence >= cfg.adherenceDropPoints) {
      reasons.push({ code: 'ADHERENCE_DROP', message: `Su adherencia bajó de ${previous.adherence}% a ${recent.adherence}% en las últimas 2 semanas` });
    }
  }
  return reasons;
}
