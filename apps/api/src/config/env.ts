import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),
  // Cookies: Secure por defecto solo en producción.
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  // Almacenamiento de imágenes: disco local en desarrollo; en producción se reemplaza por S3 (§9.2).
  STORAGE_DIR: z.string().default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(25).default(5),
  MAIL_FROM: z.string().default('Neo <no-reply@neo.local>'),
  // SMTP con autenticación para producción (en desarrollo, Mailpit no la usa).
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  // Detrás de nginx u otro proxy: número de saltos de confianza para leer la IP real (X-Forwarded-For).
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  // Solo para pruebas E2E: desactiva el límite de peticiones. Se rechaza en producción.
  DISABLE_RATE_LIMIT: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  // Silencia el log de peticiones (por ejemplo en pruebas).
  HTTP_LOG: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v !== 'false'),
});

const PLACEHOLDER = /cambia-esto|changeme|change-me|example|secret-key/i;

/** Reglas extra que solo aplican en producción: evitan arrancar con una configuración insegura por descuido. */
function productionProblems(env: z.infer<typeof schema>): string[] {
  const problems: string[] = [];
  if (env.DISABLE_RATE_LIMIT) problems.push('DISABLE_RATE_LIMIT no puede activarse en producción');
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if (PLACEHOLDER.test(env[key])) problems.push(`${key} parece un valor de ejemplo; genera uno con openssl rand -hex 32`);
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) problems.push('JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser distintos');
  if (!env.WEB_ORIGIN.startsWith('https://')) problems.push('WEB_ORIGIN debe usar https:// (RNF-03)');
  if (env.COOKIE_SECURE === false) problems.push('COOKIE_SECURE no puede ser false en producción');
  return problems;
}

export type Env = z.infer<typeof schema>;

/** Valida las variables de entorno al arrancar; falla rápido con un mensaje claro. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = schema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Variables de entorno inválidas: ${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production') {
    const problems = productionProblems(parsed.data);
    if (problems.length) throw new Error(`Configuración insegura para producción: ${problems.join('; ')}`);
  }
  return parsed.data;
}
