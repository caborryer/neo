import { computeAdherence, isValidScheduled, mergeAdherence } from './adherence';
import { evaluateRisk, type RiskInput } from './risk';
import { DEFAULT_RISK_SETTINGS } from '@neo/validation';
import { addDays } from '../common/dates';

const TODAY = '2026-11-18';
const a = (daysAgo: number, status: string) => ({ scheduledDate: addDays(TODAY, -daysAgo), status });

describe('adherencia (§4.7)', () => {
  it('ejemplo del spec: 10 programados, 8 completos, 1 parcial, 1 omitido → 80%', () => {
    const rows = [...Array.from({ length: 8 }, (_, i) => a(i + 1, 'COMPLETED')), a(9, 'PARTIAL'), a(10, 'SKIPPED')];
    expect(computeAdherence(rows, TODAY)).toMatchObject({ scheduled: 10, completed: 8, partial: 1, skipped: 1, adherence: 80, partialRate: 10 });
  });
  it('los cancelados y los futuros no cuentan; los vencidos sin hacer sí', () => {
    const r = computeAdherence([a(1, 'COMPLETED'), a(2, 'CANCELLED'), a(3, 'SCHEDULED'), a(0, 'SCHEDULED'), a(-2, 'SCHEDULED')], TODAY);
    expect(r).toMatchObject({ scheduled: 2, completed: 1, missed: 1, upcoming: 2, adherence: 50 });
  });
  it('el de hoy aún pendiente no baja la adherencia, pero completado hoy sí suma', () => {
    expect(computeAdherence([a(0, 'SCHEDULED')], TODAY)).toMatchObject({ scheduled: 0, adherence: null, upcoming: 1 });
    expect(computeAdherence([a(0, 'COMPLETED')], TODAY)).toMatchObject({ scheduled: 1, adherence: 100 });
  });
  it('sin datos no hay porcentaje (no es 0%)', () => {
    expect(computeAdherence([], TODAY)).toMatchObject({ scheduled: 0, adherence: null, partialRate: null });
  });
  it('isValidScheduled', () => {
    expect(isValidScheduled(a(1, 'SCHEDULED'), TODAY)).toBe(true);
    expect(isValidScheduled(a(0, 'SCHEDULED'), TODAY)).toBe(false);
    expect(isValidScheduled(a(1, 'CANCELLED'), TODAY)).toBe(false);
    expect(isValidScheduled(a(0, 'SKIPPED'), TODAY)).toBe(true);
  });
  it('mergeAdherence suma y recalcula, no promedia porcentajes', () => {
    const x = computeAdherence([a(1, 'COMPLETED')], TODAY); // 100% de 1
    const y = computeAdherence([a(1, 'SKIPPED'), a(2, 'SKIPPED'), a(3, 'SKIPPED')], TODAY); // 0% de 3
    expect(mergeAdherence([x, y])).toMatchObject({ scheduled: 4, completed: 1, adherence: 25 });
  });
});

describe('alertas de riesgo (§4.8)', () => {
  const base = (over: Partial<RiskInput> = {}): RiskInput => ({ today: TODAY, activeSince: '2026-01-01', assignments: [], activePlanStart: null, lastMealLogDate: null, ...over });
  const codes = (i: RiskInput) => evaluateRisk(i, DEFAULT_RISK_SETTINGS).map((r) => r.code);

  it('sin nada asignado no hay alerta (no es falta suya)', () => {
    expect(codes(base())).toEqual([]);
  });
  it('inactividad: 7+ días sin entrenar teniendo entrenamientos pendientes', () => {
    expect(codes(base({ assignments: [a(10, 'COMPLETED'), a(3, 'SCHEDULED')] }))).toContain('INACTIVITY');
    expect(codes(base({ assignments: [a(6, 'COMPLETED'), a(3, 'SCHEDULED')] }))).not.toContain('INACTIVITY');
  });
  it('inactividad: no alerta si en ese lapso no tenía nada por hacer', () => {
    expect(codes(base({ assignments: [a(20, 'COMPLETED')] }))).not.toContain('INACTIVITY');
  });
  it('baja adherencia: 3 últimos sin completar', () => {
    expect(codes(base({ assignments: [a(1, 'SCHEDULED'), a(2, 'SKIPPED'), a(3, 'SCHEDULED'), a(4, 'COMPLETED')] }))).toContain('CONSECUTIVE_MISSED');
    expect(codes(base({ assignments: [a(1, 'SCHEDULED'), a(2, 'COMPLETED'), a(3, 'SCHEDULED')] }))).not.toContain('CONSECUTIVE_MISSED');
  });
  it('baja adherencia necesita al menos K entrenamientos', () => {
    expect(codes(base({ assignments: [a(1, 'SCHEDULED'), a(2, 'SKIPPED')] }))).not.toContain('CONSECUTIVE_MISSED');
  });
  it('registros de comida: con plan, 5+ días sin enviar; sin plan nunca', () => {
    expect(codes(base({ activePlanStart: '2026-11-01', lastMealLogDate: '2026-11-10' }))).toContain('NO_FOOD_LOGS');
    expect(codes(base({ activePlanStart: '2026-11-01', lastMealLogDate: '2026-11-16' }))).not.toContain('NO_FOOD_LOGS');
    expect(codes(base({ activePlanStart: null, lastMealLogDate: null }))).not.toContain('NO_FOOD_LOGS');
  });
  it('un plan recién asignado no alerta; contar desde el inicio del plan, no desde registros viejos', () => {
    expect(codes(base({ activePlanStart: '2026-11-17', lastMealLogDate: null }))).not.toContain('NO_FOOD_LOGS');
    expect(codes(base({ activePlanStart: '2026-11-10', lastMealLogDate: '2026-09-01' }))).toContain('NO_FOOD_LOGS');
  });
  it('caída de adherencia: 2 semanas recientes vs. 2 anteriores', () => {
    const prev = [a(15, 'COMPLETED'), a(17, 'COMPLETED'), a(19, 'COMPLETED'), a(21, 'COMPLETED')];
    const recent = [a(2, 'COMPLETED'), a(4, 'SKIPPED'), a(6, 'SKIPPED'), a(8, 'SKIPPED')];
    const r = evaluateRisk(base({ assignments: [...prev, ...recent] }), DEFAULT_RISK_SETTINGS);
    expect(r.find((x) => x.code === 'ADHERENCE_DROP')?.message).toBe('Su adherencia bajó de 100% a 25% en las últimas 2 semanas');
  });
  it('caída de adherencia: con muestras pequeñas no se alerta', () => {
    expect(codes(base({ assignments: [a(15, 'COMPLETED'), a(2, 'SKIPPED')] }))).not.toContain('ADHERENCE_DROP');
  });
  it('los umbrales son configurables', () => {
    const rows = [a(4, 'COMPLETED'), a(1, 'SCHEDULED')];
    expect(evaluateRisk(base({ assignments: rows }), { ...DEFAULT_RISK_SETTINGS, inactivityDays: 3 }).map((r) => r.code)).toContain('INACTIVITY');
    expect(evaluateRisk(base({ assignments: rows }), DEFAULT_RISK_SETTINGS).map((r) => r.code)).not.toContain('INACTIVITY');
  });
  it('todos los motivos traen un texto legible', () => {
    const rows = [a(10, 'SKIPPED'), a(11, 'SKIPPED'), a(12, 'SKIPPED'), a(1, 'SCHEDULED')];
    for (const r of evaluateRisk(base({ assignments: rows, activePlanStart: '2026-10-01' }), DEFAULT_RISK_SETTINGS)) expect(r.message.length).toBeGreaterThan(10);
  });
});
