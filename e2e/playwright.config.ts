import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contra una base de datos DESECHABLE (E2E_DATABASE_URL). El global-setup la reinicia en cada corrida,
 * por eso nunca debe apuntar a la base de desarrollo ni a producción.
 * Requiere Postgres y Mailpit (SMTP 1025 / API 8025) levantados; ver docs/QA.md.
 */
const DB = process.env.E2E_DATABASE_URL ?? 'postgresql://neo:neo@localhost:5433/neo_e2e?schema=public';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export const E2E = {
  coachEmail: 'coach-e2e@neo.local',
  coachPassword: 'E2eClave12345!',
  mailpit: MAILPIT,
  api: 'http://localhost:3100/api/v1',
  web: 'http://localhost:5174',
};

export default defineConfig({
  testDir: './tests',
  globalSetup: './support/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: process.env.CI ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'list',
  outputDir: 'test-results',
  use: { baseURL: E2E.web, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'es-CO' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run build -w @neo/api && npm run start -w @neo/api',
      cwd: '..',
      url: 'http://localhost:3100/api/v1/health',
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        API_PORT: '3100',
        DATABASE_URL: DB,
        WEB_ORIGIN: E2E.web,
        JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789abcdef0123456789',
        JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdef012345678',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        DISABLE_RATE_LIMIT: 'true',
        HTTP_LOG: 'false',
        STORAGE_DIR: '/tmp/neo-e2e-storage',
      },
    },
    {
      command: 'npm run dev -w @neo/web -- --port 5174 --strictPort',
      cwd: '..',
      url: 'http://localhost:5174',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_PROXY: 'http://localhost:3100' },
    },
  ],
});
