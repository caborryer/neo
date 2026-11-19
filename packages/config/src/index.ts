/** Constantes compartidas entre web y api. Fuente: docs/ESPECIFICACION.md */

export const API_PREFIX = 'api/v1';
export const DEFAULT_TIMEZONE = 'America/Bogota';

export const PAGINATION = {
  defaultPage: 1,
  defaultLimit: 10,
  maxLimit: 100,
} as const;

/** §9.2: formatos iniciales de imagen. */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Suposición: tamaño máximo por defecto; es configurable por entorno (S3_MAX_UPLOAD_MB). */
export const DEFAULT_MAX_UPLOAD_MB = 5;

/** Suposición (HU-16): meta semanal por defecto cuando la Coach no la define. */
export const DEFAULT_WEEKLY_GOAL = 3;

/** §4.8: umbrales configurables de usuarias en riesgo (valores por defecto). */
export const RISK_DEFAULTS = {
  inactivityDays: 7,
  consecutivePendingWorkouts: 3,
} as const;
