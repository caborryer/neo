import type { RiskCode } from '@neo/shared-types';

export const RISK_LABEL: Record<RiskCode, string> = {
  INACTIVITY: 'Inactividad',
  CONSECUTIVE_MISSED: 'Baja adherencia',
  NO_FOOD_LOGS: 'Sin registros de comida',
  ADHERENCE_DROP: 'Caída de adherencia',
};

export const RANGE_OPTIONS = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
];

export const pct = (n: number | null): string => (n === null ? '—' : `${n}%`);
