# Neo

Plataforma web de entrenamiento, nutrición y acompañamiento personalizado: una Coach y múltiples usuarias.

- Especificación completa: [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md)
- Backlog e historias de usuario: [`docs/BACKLOG.md`](docs/BACKLOG.md)
- Reglas para trabajar con Claude: [`CLAUDE.md`](CLAUDE.md)

## Requisitos

- Node.js 22 o superior (`.nvmrc`)
- Docker Desktop (PostgreSQL, MinIO y Mailpit para desarrollo)

## Puesta en marcha

```bash
# 1. Variables de entorno
cp .env.example .env            # revisa los secretos y las credenciales de la Coach

# 2. Servicios de desarrollo (PostgreSQL, MinIO, Mailpit)
npm run infra:up

# 3. Dependencias (compila los paquetes compartidos y genera el cliente Prisma)
npm install

# 4. Base de datos: migración inicial + restricciones (ver "Base de datos")
npm run db:migrate -- --name init

# 5. Crear la Coach única
npm run db:seed

# 6. Arrancar
npm run dev:api                 # http://localhost:3000/api/v1/health
npm run dev:web                 # http://localhost:5173
```

Mailpit (correos de desarrollo): http://localhost:8025 · Consola de MinIO: http://localhost:9001

## Base de datos

El esquema está en `apps/api/prisma/schema.prisma` (23 modelos, §7 de la especificación).
Prisma no expresa algunas restricciones de integridad; están en `apps/api/prisma/sql/constraints.sql`:

- una sola Coach (índice único parcial) y regla `coachId` según el rol,
- plan nutricional activo sin solapamiento de fechas por usuaria (exclusion constraint),
- rangos de calificación y porcentajes.

Después de la migración inicial, crea una segunda migración con ese SQL:

```bash
cd apps/api
npx dotenv -e ../../.env -- npx prisma migrate dev --create-only --name db_constraints
# pega el contenido de prisma/sql/constraints.sql en el archivo migration.sql generado
npx dotenv -e ../../.env -- npx prisma migrate dev
```

## Estructura

```
neo/
├── apps/
│   ├── web/   React + TypeScript + Vite + Tailwind (tokens --color-neo-*)
│   └── api/   NestJS modular + Prisma (API REST en /api/v1)
├── packages/
│   ├── shared-types/   enums y contrato de la API
│   ├── validation/     esquemas Zod compartidos
│   └── config/         constantes compartidas
└── docker-compose.yml
```

## Scripts útiles

| Comando | Qué hace |
| --- | --- |
| `npm run dev:api` / `npm run dev:web` | Arranca la API / el frontend en modo desarrollo |
| `npm test` | Pruebas de todos los paquetes |
| `npm run typecheck` | Verifica tipos en todos los paquetes |
| `npm run build` | Compila paquetes, API y web |
| `npm run infra:up` / `infra:down` | Levanta / detiene PostgreSQL, MinIO y Mailpit |

## Estado

Fases 0 a 4 completas (base, autenticación, contenido, nutrición, dashboards y alertas). Fase 5 (pruebas, pulido y despliegue):

- Endurecimiento de la API para producción (validación de configuración, log de peticiones, proxy de confianza).
- Despliegue con Docker Compose + Caddy, backups y restauración: ver [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).
- CI en GitHub Actions (`.github/workflows/ci.yml`) y suite E2E con Playwright (`npm run test:e2e`).
- Checklist de QA manual: [`docs/QA.md`](docs/QA.md).
# neo
