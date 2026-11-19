/** Fecha de hoy (YYYY-MM-DD) en una zona horaria IANA (RNF-16). Si la zona es inválida usa UTC. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Las columnas @db.Date se tratan siempre en UTC para no correr el día por la zona del servidor. */
export const parseDateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
export const formatDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

/** Desfase (ms) de una zona horaria respecto a UTC en un instante dado. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Fecha y hora locales (en `timeZone`) → instante UTC. Zona inválida → se interpreta como UTC. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  try {
    const first = guess - zoneOffsetMs(guess, timeZone);
    // Segunda pasada: si el cambio de horario cae entre el primer cálculo y el real, se corrige.
    return new Date(guess - zoneOffsetMs(first, timeZone));
  } catch {
    return new Date(guess);
  }
}

/** Instante UTC → fecha (YYYY-MM-DD) y hora (HH:mm) locales en `timeZone`. */
export function utcToZoned(instant: Date, timeZone: string): { date: string; time: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(instant);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
  } catch {
    return { date: instant.toISOString().slice(0, 10), time: instant.toISOString().slice(11, 16) };
  }
}

/** Suma (o resta) días a una fecha YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  return formatDateOnly(new Date(parseDateOnly(date).getTime() + days * 86_400_000));
}

/** Diferencia en días (b - a) entre dos fechas YYYY-MM-DD. */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDateOnly(b).getTime() - parseDateOnly(a).getTime()) / 86_400_000);
}

/** Lunes de la semana (lunes a domingo) que contiene la fecha. */
export function weekStartOf(date: string): string {
  const dow = (parseDateOnly(date).getUTCDay() + 6) % 7; // lunes = 0
  return addDays(date, -dow);
}

/** Día de la semana de una fecha, con la convención del spec (MONDAY..SUNDAY). */
export function dayOfWeekName(date: string): 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY' {
  return (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const)[(parseDateOnly(date).getUTCDay() + 6) % 7]!;
}
