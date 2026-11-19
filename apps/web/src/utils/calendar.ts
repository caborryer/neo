/** Utilidades de calendario en hora local del navegador. Las fechas viajan como YYYY-MM-DD. */
const pad = (n: number) => String(n).padStart(2, '0');

export const toDateKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = (): string => toDateKey(new Date());

/** Parsea YYYY-MM-DD como fecha local (mediodía, para evitar saltos por horario de verano). */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

export const addMonths = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth() + n, 1, 12);

/** Semanas de lunes a domingo que cubren el mes completo (35 o 42 celdas). */
export function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => new Date(year, month, 1 - offset + i, 12));
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const grid = buildMonthGrid(year, month);
  return { from: toDateKey(grid[0]!), to: toDateKey(grid[grid.length - 1]!) };
}

export const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

const monthFormatter = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
export const monthLabel = (d: Date): string => {
  const s = monthFormatter.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const dayFormatter = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
export const dayLabel = (key: string): string => {
  const s = dayFormatter.format(fromDateKey(key));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de la usuaria, no en la del navegador (RNF-16). */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return toDateKey(now);
  }
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDaysKey(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Lunes de la semana (lunes a domingo) que contiene la fecha. */
export function weekStartKey(key: string): string {
  const offset = (fromDateKey(key).getDay() + 6) % 7;
  return addDaysKey(key, -offset);
}
