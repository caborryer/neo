import { formatDateOnly, parseDateOnly, todayIn } from './dates';

describe('dates (RNF-16)', () => {
  it('el "hoy" depende de la zona horaria de la usuaria', () => {
    const instant = new Date('2026-11-19T03:30:00Z'); // 22:30 del 18 en Bogotá (UTC-5)
    expect(todayIn('America/Bogota', instant)).toBe('2026-11-18');
    expect(todayIn('Europe/Madrid', instant)).toBe('2026-11-19');
  });
  it('zona inválida cae en UTC', () => {
    expect(todayIn('No/Existe', new Date('2026-11-19T03:30:00Z'))).toBe('2026-11-19');
  });
  it('parse/format de fechas sin hora son simétricos', () => {
    expect(formatDateOnly(parseDateOnly('2026-12-01'))).toBe('2026-12-01');
  });
});

import { addDays, utcToZoned, zonedTimeToUtc } from './dates';

describe('zonas horarias (diario alimenticio)', () => {
  it('Bogotá es UTC-5 todo el año', () => {
    expect(zonedTimeToUtc('2026-11-18', '07:15', 'America/Bogota').toISOString()).toBe('2026-11-18T12:15:00.000Z');
    expect(utcToZoned(new Date('2026-11-18T12:15:00Z'), 'America/Bogota')).toEqual({ date: '2026-11-18', time: '07:15' });
  });
  it('una comida de noche cae en el día local, no en el UTC', () => {
    // 23:30 en Bogotá ya es 04:30 UTC del día siguiente.
    const utc = zonedTimeToUtc('2026-11-18', '23:30', 'America/Bogota');
    expect(utc.toISOString()).toBe('2026-11-19T04:30:00.000Z');
    expect(utcToZoned(utc, 'America/Bogota').date).toBe('2026-11-18');
  });
  it('respeta el horario de verano', () => {
    expect(zonedTimeToUtc('2026-07-01', '12:00', 'America/New_York').toISOString()).toBe('2026-07-01T16:00:00.000Z');
    expect(zonedTimeToUtc('2026-12-01', '12:00', 'America/New_York').toISOString()).toBe('2026-12-01T17:00:00.000Z');
  });
  it('ida y vuelta conserva fecha y hora', () => {
    const utc = zonedTimeToUtc('2026-03-08', '13:45', 'America/New_York');
    expect(utcToZoned(utc, 'America/New_York')).toEqual({ date: '2026-03-08', time: '13:45' });
  });
  it('zona inválida cae a UTC sin lanzar', () => {
    expect(zonedTimeToUtc('2026-11-18', '10:00', 'Nope/Zone').toISOString()).toBe('2026-11-18T10:00:00.000Z');
    expect(utcToZoned(new Date('2026-11-18T10:00:00Z'), 'Nope/Zone')).toEqual({ date: '2026-11-18', time: '10:00' });
  });
  it('addDays cruza meses y años', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});
