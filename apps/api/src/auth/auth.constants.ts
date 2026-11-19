export const ACCESS_COOKIE = 'neo_at';
export const REFRESH_COOKIE = 'neo_rt';
/** El refresh token solo viaja a los endpoints de auth. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
/** Suposición (HU-02): enlaces de invitación y recuperación válidos 24 horas. */
export const PASSWORD_TOKEN_TTL_HOURS = 24;
export const UNAVAILABLE_ACCESS_MESSAGE = 'Tu acceso no está disponible. Comunícate con tu Coach.';
