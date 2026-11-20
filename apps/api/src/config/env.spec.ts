import { validateEnv } from './env';

const base = {
  DATABASE_URL: 'postgresql://x',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('validateEnv', () => {
  it('aplica valores por defecto', () => {
    const env = validateEnv(base);
    expect(env.API_PORT).toBe(3000);
    expect(env.ACCESS_TOKEN_TTL_MINUTES).toBe(15);
  });

  it('rechaza secretos cortos', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'corto' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rechaza si falta DATABASE_URL', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });
});

describe('validateEnv · producción', () => {
  const prod = { ...base, NODE_ENV: 'production', SMTP_HOST: 'smtp.proveedor.com', WEB_ORIGIN: 'https://neo.example.com', JWT_ACCESS_SECRET: 'x'.repeat(40), JWT_REFRESH_SECRET: 'y'.repeat(40) };

  it('acepta una configuración correcta', () => {
    expect(validateEnv(prod).NODE_ENV).toBe('production');
  });
  it('rechaza secretos de ejemplo', () => {
    expect(() => validateEnv({ ...prod, JWT_ACCESS_SECRET: 'cambia-esto-por-un-secreto-largo-de-32-caracteres-o-mas' })).toThrow(/valor de ejemplo/);
  });
  it('rechaza secretos iguales', () => {
    expect(() => validateEnv({ ...prod, JWT_REFRESH_SECRET: prod.JWT_ACCESS_SECRET })).toThrow(/distintos/);
  });
  it('exige https y cookies seguras', () => {
    expect(() => validateEnv({ ...prod, WEB_ORIGIN: 'http://neo.example.com' })).toThrow(/https/);
    expect(() => validateEnv({ ...prod, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
  });
  it('exige un proveedor de correo real: SMTP distinto de localhost o Resend con su clave', () => {
    expect(() => validateEnv({ ...prod, SMTP_HOST: 'localhost' })).toThrow(/SMTP_HOST/);
    expect(() => validateEnv({ ...prod, SMTP_HOST: 'localhost', MAIL_PROVIDER: 'resend' })).toThrow(/RESEND_API_KEY/);
    expect(validateEnv({ ...prod, SMTP_HOST: 'localhost', MAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_123' }).MAIL_PROVIDER).toBe('resend');
  });
  it('lee PORT, API_HOST y CLIENT_IP_HEADER para Railway', () => {
    const env = validateEnv({ ...prod, PORT: '8080', API_HOST: '::', CLIENT_IP_HEADER: 'x-real-ip' });
    expect([env.PORT, env.API_HOST, env.CLIENT_IP_HEADER]).toEqual([8080, '::', 'x-real-ip']);
    expect(() => validateEnv({ ...prod, CLIENT_IP_HEADER: 'x real ip; drop' })).toThrow(/CLIENT_IP_HEADER/);
  });
  it('rechaza DISABLE_RATE_LIMIT en producción pero lo permite fuera', () => {
    expect(() => validateEnv({ ...prod, DISABLE_RATE_LIMIT: 'true' })).toThrow(/DISABLE_RATE_LIMIT/);
    expect(validateEnv({ ...base, DISABLE_RATE_LIMIT: 'true' }).DISABLE_RATE_LIMIT).toBe(true);
  });
  it('en desarrollo los secretos de ejemplo siguen permitidos', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'cambia-esto-por-un-secreto-largo-de-32-caracteres-o-mas' })).not.toThrow();
  });
  it('parsea TRUST_PROXY y SMTP_SECURE', () => {
    const env = validateEnv({ ...base, TRUST_PROXY: '1', SMTP_SECURE: 'true' });
    expect(env.TRUST_PROXY).toBe(1);
    expect(env.SMTP_SECURE).toBe(true);
    expect(validateEnv(base).HTTP_LOG).toBe(true);
  });
});
