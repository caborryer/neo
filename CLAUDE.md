# Neo — Reglas del proyecto

Neo (antes HerFit) es una plataforma web de entrenamiento, nutrición y acompañamiento: **una Coach, múltiples usuarias**. Nunca escribas "HerFit" en código, textos, nombres de paquetes ni variables; el nombre es **Neo**.

## Fuente de verdad

@docs/ESPECIFICACION.md

- La especificación manda. Si algo no está ahí, **no lo inventes**: pregunta antes de implementarlo.
- Si el código y la especificación se contradicen, gana la especificación; avisa de la contradicción.
- Antes de cada tarea, lee las secciones relevantes de la especificación y cita su número en tu respuesta (por ejemplo "§7.7, §4.3").
- El backlog con historias de usuario está en `docs/BACKLOG.md` (HU-01 a HU-33). Trabaja una historia a la vez y nómbrala en los commits (`feat(HU-05): ...`).
- No construyas funcionalidades fuera del MVP (Retos, Estadísticas avanzadas, Mensajería, Web Push, Contenido, PWA) salvo que se pida explícitamente.

## Stack (no cambiar ni añadir alternativas sin permiso)

- Frontend: React + TypeScript + Vite + Tailwind CSS, shadcn/ui, Lucide React, React Router, TanStack Query, React Hook Form + Zod, Recharts.
- Backend: NestJS modular (monolito modular, sin microservicios). API REST bajo `/api/v1`.
- Datos: PostgreSQL + Prisma. Archivos en almacenamiento S3 compatible, **bucket privado**.
- Video: YouTube no listado (embed con `youtube-nocookie`).
- Pruebas: Vitest + Testing Library, Playwright para E2E. Docker para desarrollo y despliegue.
- Es una **web responsive**, no una app nativa. Usuaria mobile-first; panel Coach desktop-first.

## Estructura del repositorio (§6.4)

Monorepo `neo/` con `apps/web`, `apps/api` (+ `prisma/`), `packages/shared-types`, `packages/validation`, `packages/config`, `docker-compose.yml`, `.env.example`. Respeta los nombres de módulos y carpetas de la especificación. Cada dominio del backend tiene su propio módulo, servicio, controlador y DTOs.

## Reglas de negocio que nunca se rompen

1. Existe **una sola Coach**; no hay registro público de Coaches. Cada usuaria tiene `coachId`; la Coach no. Índice único parcial en PostgreSQL.
2. La Coach controla el acceso (PENDING, ACTIVE, SUSPENDED, INACTIVE). La usuaria nunca cambia su estado, rol ni `coachId`. Cuenta con `accessExpiresAt` vencida se bloquea aunque figure ACTIVE.
3. Cada cambio de acceso crea un `UserAccessEvent` **en la misma transacción**.
4. El **backend es la autoridad** de permisos: valida rol, estado, vigencia, relación Coach-usuaria y que el recurso esté asignado. Protege contra acceso horizontal (cambio de IDs). Ocultar opciones en el frontend no cuenta.
5. Planes nutricionales: plan lógico → versión **inmutable** → días → comidas → alimentos → asignación. Una asignación apunta a una versión. Un solo plan activo por usuaria por fecha; al reemplazar, se cierra la asignación anterior en una transacción. No se borran versiones usadas.
6. El diario registra lo realmente consumido; `plannedMealId` es opcional. Estados: DRAFT, SUBMITTED, REVIEWED, NEEDS_CHANGES.
7. El progreso y la adherencia se calculan **en backend**. Adherencia = completados / programados válidos × 100; no cuentan descansos ni asignaciones canceladas; los parciales se muestran aparte.
8. Los registros de sesiones y feedback son **idempotentes**. Una sesión tiene como máximo una retroalimentación.
9. El progreso de retos nunca lo envía el frontend.
10. Fechas en UTC en base de datos; se muestran en la zona horaria de la usuaria (por defecto `America/Bogota`).
11. Cambios de estado, asignaciones de planes y operaciones que modifican historial usan transacciones.
12. Los números del mockup son ilustrativos: los indicadores salen siempre de datos reales.

## Seguridad y privacidad (§10)

- Access tokens cortos y refresh tokens rotativos en cookies HttpOnly (Secure en producción). Nada de tokens en localStorage.
- Hash con Argon2id o bcrypt. Rate limiting en login y recuperación. CSRF cubierto si se usan cookies.
- Fotos: bucket privado, URL prefirmada para subir y URL temporal para leer, validar MIME real, tamaño máximo y nombre aleatorio. Solo JPG, PNG y WebP.
- Auditoría con `AuditLog` (actor, acción, recurso, ID, fecha). Nunca registrar contraseñas, tokens ni datos sensibles en logs.
- Cumplimiento: Ley 1581 de 2012 (Colombia); consentimiento antes de subir fotos.

## Convenciones de código

- TypeScript estricto; sin `any` salvo justificación comentada. Tipos compartidos en `packages/shared-types` y validación en `packages/validation`.
- Respuestas de la API con el contrato de §8: `{ data }`, `{ data, meta: { page, limit, total, totalPages } }` y errores `{ statusCode, message, error, details[] }`. Los listados admiten paginación, filtros y ordenamiento.
- Frontend: la lógica de negocio va en servicios, hooks y módulos, **no** en componentes visuales. Usa los componentes reutilizables de §12 (AppButton, AppCard, etc.) antes de crear otros.
- Diseño: usa los tokens `--color-neo-*` y la escala de espaciado, tipografía Inter, radios y sombras de §3. No uses colores hexadecimales sueltos en componentes. Iconos solo de Lucide según §3.7.
- Todos los estados de UI existen: loading (skeleton), empty, error con reintentar, success, disabled, unauthorized y validation (§4.10). No dependas solo del color para comunicar estado.
- Accesibilidad AA: foco visible, etiquetas, contraste, navegación por teclado.
- Textos de la interfaz en español.

## Suposiciones vigentes (pendientes de confirmar con la Coach; §17)

- Cuentas: invitación por correo con enlace temporal (reutiliza el flujo de restablecer contraseña).
- Entrenamientos: asignación individual; una sesión por asignación en el MVP.
- Nutrición: planes de 7 días (lunes a domingo) con vigencia.
- Comunicación: solo comentarios contextuales; sin mensajería privada.
- En caso de cambiar alguna, actualiza este archivo y `docs/BACKLOG.md` en el mismo commit.

## Cómo trabajar

1. Lee la historia (HU) y las secciones de la especificación que toca.
2. Si falta información o hay ambigüedad, pregunta; si es menor, asume el estándar de la industria y márcalo como **Suposición** en el PR.
3. Implementa backend y frontend de la historia, con pruebas de las reglas críticas (autorización, acceso, versionado, adherencia, idempotencia).
4. Verifica con los criterios de aceptación de §15 y los de la HU antes de dar algo por terminado.
5. Informa qué cambió, qué quedó pendiente y qué decisiones se asumieron.

## Comandos

```bash
npm install            # compila los paquetes compartidos y genera el cliente Prisma
npm run infra:up       # PostgreSQL y Mailpit con Docker
npm run db:migrate     # migraciones Prisma (ver README, "Base de datos")
npm run db:seed        # crea la Coach única
npm run dev:api        # API en http://localhost:3000/api/v1
npm run dev:web        # web en http://localhost:5173
npm test               # pruebas de todos los paquetes
npm run typecheck      # tipos en todos los paquetes
npm run build          # compila todo
```

Versiones fijadas a propósito: NestJS 11 (la serie 12 es solo ESM y rompe Jest y el build CommonJS), Prisma 6 y TypeScript 5.9 (tsup no soporta TypeScript 7). No las cambies sin pedir permiso.
