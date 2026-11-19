import { addMonths, buildMonthGrid, dayLabel, fromDateKey, monthRange, toDateKey } from './calendar';

describe('calendar utils', () => {
  it('la cuadrícula empieza en lunes y termina en domingo, con semanas completas', () => {
    for (const [y, m] of [[2026, 10], [2026, 1], [2027, 1], [2026, 11]] as const) {
      const grid = buildMonthGrid(y, m);
      expect(grid.length % 7).toBe(0);
      expect(grid[0]!.getDay()).toBe(1);
      expect(grid[grid.length - 1]!.getDay()).toBe(0);
      expect(grid.some((d) => d.getMonth() === m && d.getDate() === 1)).toBe(true);
    }
  });
  it('noviembre 2026 (1 de nov = domingo) incluye el lunes 26 de oct', () => {
    const { from, to } = monthRange(2026, 10);
    expect(from).toBe('2026-10-26');
    expect(to).toBe('2026-12-06');
  });
  it('febrero 2027 empieza en lunes 1 y ocupa 4 semanas', () => {
    expect(buildMonthGrid(2027, 1)).toHaveLength(28);
  });
  it('toDateKey/fromDateKey son simétricos y addMonths cruza el año', () => {
    expect(toDateKey(fromDateKey('2026-12-31'))).toBe('2026-12-31');
    expect(addMonths(new Date(2026, 11, 15), 1).getFullYear()).toBe(2027);
    expect(addMonths(new Date(2026, 0, 15), -1).getMonth()).toBe(11);
  });
  it('dayLabel en español', () => {
    expect(dayLabel('2026-11-18')).toMatch(/^Miércoles/);
  });
});
