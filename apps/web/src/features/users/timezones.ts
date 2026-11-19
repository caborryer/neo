/** Zonas horarias ofrecidas en los formularios (Suposición: LatAm + algunas frecuentes). */
export const TIMEZONES = [
  'America/Bogota',
  'America/Mexico_City',
  'America/Lima',
  'America/Guayaquil',
  'America/Caracas',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
].map((tz) => ({ value: tz, label: tz.replace('America/', '').replace('Europe/', '').replace(/_/g, ' ') }));
