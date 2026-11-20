import { describe, expect, it } from 'vitest';
import { advancedStatsQuerySchema } from './index';

describe('advancedStatsQuerySchema (HU-31)', () => {
  it('acepta vacío (el servicio usa los últimos 90 días)', () => {
    expect(advancedStatsQuerySchema.safeParse({}).success).toBe(true);
  });
  it('acepta un período válido', () => {
    expect(advancedStatsQuerySchema.safeParse({ from: '2026-01-01', to: '2026-03-31' }).success).toBe(true);
  });
  it('exige from y to juntos', () => {
    expect(advancedStatsQuerySchema.safeParse({ from: '2026-01-01' }).success).toBe(false);
    expect(advancedStatsQuerySchema.safeParse({ to: '2026-01-01' }).success).toBe(false);
  });
  it('rechaza fechas invertidas, inexistentes o con formato libre', () => {
    expect(advancedStatsQuerySchema.safeParse({ from: '2026-03-01', to: '2026-01-01' }).success).toBe(false);
    expect(advancedStatsQuerySchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(false);
    expect(advancedStatsQuerySchema.safeParse({ from: '01/01/2026', to: '2026-03-01' }).success).toBe(false);
  });
  it('limita el período a 366 días', () => {
    expect(advancedStatsQuerySchema.safeParse({ from: '2025-01-01', to: '2026-01-01' }).success).toBe(true); // 366 días
    expect(advancedStatsQuerySchema.safeParse({ from: '2025-01-01', to: '2026-01-02' }).success).toBe(false);
  });
});
