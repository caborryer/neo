import { execSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const DB = process.env.E2E_DATABASE_URL ?? 'postgresql://neo:neo@localhost:5433/neo_e2e?schema=public';

/** Reinicia el esquema de la base E2E, aplica migraciones y crea la Coach. */
export default function globalSetup() {
  const api = path.resolve(import.meta.dirname, '../../apps/api');
  const migrations = path.join(api, 'prisma/migrations');
  if (!existsSync(migrations) || readdirSync(migrations).length === 0) {
    throw new Error('No hay migraciones en apps/api/prisma/migrations. Haz commit de las migraciones (npm run prisma:migrate) antes de correr E2E.');
  }
  if (!/e2e|test/i.test(new URL(DB.replace(/^postgresql:/, 'http:')).pathname)) {
    throw new Error('E2E_DATABASE_URL debe apuntar a una base cuyo nombre contenga "e2e" o "test" (se borra en cada corrida).');
  }
  const env = {
    ...process.env,
    DATABASE_URL: DB,
    SEED_COACH_EMAIL: 'coach-e2e@neo.local',
    SEED_COACH_PASSWORD: 'E2eClave12345!',
  };
  const run = (cmd: string) => execSync(cmd, { cwd: api, env, stdio: 'inherit' });
  run('npx prisma migrate reset --force --skip-seed --skip-generate');
  run('npx ts-node prisma/seed.ts');
}
