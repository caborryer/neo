# Neo — Despliegue en Railway

Alternativa al VPS (`docs/DESPLIEGUE.md`): Railway construye y reinicia los contenedores desde GitHub y te da HTTPS y Postgres sin administrar un servidor.

> Esto se preparó con la documentación de Railway vigente en noviembre 2026 pero **no se ha probado en un proyecto real**. Haz el primer despliegue en un proyecto de pruebas con datos falsos. Los nombres exactos del panel pueden variar.

## 1. Arquitectura

```
Internet ──HTTPS──▶ [ web ]  Caddy: sirve la web y reenvía /api/*
                       │  red privada (api.railway.internal:3000)
                       ▼
                    [ api ]  NestJS ── Volumen /data/storage (fotos)
                       │  red privada
                       ▼
                  [ Postgres ]
```
- Solo **web** tiene dominio público. La **api** no se expone: así el navegador ve un único origen y las cookies/CSRF funcionan igual que en el VPS.
- Archivos nuevos: `apps/web/Dockerfile.railway`, `deploy/Caddyfile.railway`, `apps/api/docker-entrypoint.sh`, `deploy/env.railway.example`, `scripts/backup-railway.sh`.

## 2. Antes de empezar
1. El repo está en GitHub y **`apps/api/prisma/migrations` está commiteado** (incluye `constraints.sql` pegado en la primera migración; ver README). Sin migraciones la base queda vacía.
2. Dominio propio (recomendado, para el correo) y una cuenta en **Resend** (resend.com).
3. **Correo:** Railway bloquea el SMTP (puertos 25/465/587/2525) en los planes Free, Trial y Hobby; solo el plan Pro lo permite. Por eso Neo envía con la API HTTPS de Resend (`MAIL_PROVIDER=resend`). Con Gmail/SMTP solo funcionaría en plan Pro (`MAIL_PROVIDER=smtp` + `SMTP_*`).
4. En Resend: *Domains → Add Domain*, agrega en tu DNS los registros que te indique (SPF/DKIM) y espera a que figure como verificado. Crea una *API Key*. `MAIL_FROM` debe usar ese dominio.

## 3. Crear el proyecto
1. Railway → *New Project* → **Deploy PostgreSQL**. Deja el nombre `Postgres`.
2. En el mismo proyecto: *New* → *GitHub Repo* → tu repo. Hazlo dos veces para tener dos servicios y renómbralos **`api`** y **`web`**.

## 4. Servicio `api`
En *Settings*:
- **Build → Dockerfile Path:** `apps/api/Dockerfile` (si el panel no lo ofrece, crea la variable `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`). El *Root Directory* se deja en la raíz del repo: el Dockerfile necesita `packages/`.
- **Watch Paths:** `/apps/api/**`, `/packages/**`, `/package.json`, `/package-lock.json` (así no se reconstruye con cambios solo de la web).
- **Healthcheck Path:** `/api/v1/health`.
- **Networking:** **no** generes dominio público.
- **Volumes:** *Add Volume* → Mount Path **`/data/storage`** (las fotos viven aquí; sin volumen se pierden en cada despliegue).

En *Variables*, pega el bloque «api» de `deploy/env.railway.example` y completa: `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` (`openssl rand -hex 32`, distintos), `RESEND_API_KEY`, `MAIL_FROM` y las `SEED_COACH_*`.

Al arrancar, el contenedor corrige el dueño del volumen (Railway lo monta como root), baja a un usuario sin privilegios, aplica las migraciones (`RUN_MIGRATIONS=true`) y crea la Coach (`RUN_SEED=true`, idempotente).

## 5. Servicio `web`
- **Build → Dockerfile Path:** `apps/web/Dockerfile.railway`.
- **Watch Paths:** `/apps/web/**`, `/packages/**`, `/deploy/**`, `/package.json`, `/package-lock.json`.
- **Healthcheck Path:** `/healthz`.
- **Variables:** `PORT=8080` y `API_UPSTREAM=api.railway.internal:3000`.
- **Networking → Generate Domain** apuntando al puerto **8080**. Después puedes añadir tu dominio propio (*Custom Domain*) y actualizar `WEB_ORIGIN` en `api`.

Orden recomendado: despliega `Postgres` → `api` → `web`. Si `web` arranca antes que `api`, solo verás errores de /api hasta que esté lista.

## 6. Primer arranque: verificación
1. `https://<tu-dominio>/api/v1/health` → `{"data":{"database":"up",...}}`.
2. Entra como Coach con `SEED_COACH_EMAIL` y la clave. **Cambia la clave** y luego, en `api`: `RUN_SEED=false` y **borra** `SEED_COACH_EMAIL`/`SEED_COACH_PASSWORD`.
3. Crea una usuaria de prueba: debe llegar el correo de invitación (si no llega, mira los logs de `api` y el panel de Resend).
4. Sube una foto de comida y haz *Redeploy* de `api`: la foto debe seguir ahí (confirma que el volumen funciona).
5. **IP real y límite de intentos:** el login permite 5 intentos por minuto por IP. Desde tu wifi haz 6 intentos fallidos (te bloquea con 429) y enseguida entra bien desde el celular con datos móviles. Si el celular también queda bloqueado, todas las visitantes comparten una IP: cambia `CLIENT_IP_HEADER` a `x-forwarded-for` y repite. (Aunque eso pase, el bloqueo por cuenta, 10 fallos por correo, sigue protegiendo.)

## 7. Variables importantes (resumen)
| Servicio | Variable | Para qué |
|---|---|---|
| api | `API_HOST=::` | La red privada de Railway usa IPv6; sin esto `web` no llega a la API |
| api | `PORT=3000` | Railway usa `PORT` para el healthcheck |
| api | `WEB_ORIGIN` | CORS y enlaces de los correos; debe ser https |
| api | `CLIENT_IP_HEADER=x-real-ip` | IP real tras el borde de Railway |
| api | `RUN_MIGRATIONS` / `RUN_SEED` | Migraciones al arrancar / Coach inicial |
| web | `API_UPSTREAM` | Dirección privada de la API |

La API se niega a arrancar en producción con secretos de ejemplo, `WEB_ORIGIN` sin https, sin proveedor de correo real, etc.

## 8. Actualizaciones
Cada `git push` a la rama conectada reconstruye lo que cambió (según los *Watch Paths*). En cada servicio puedes activar la opción de esperar a que el CI de GitHub termine antes de desplegar. Las migraciones se aplican solas al arrancar `api`; haz un backup antes de migraciones grandes.
**Volver atrás:** panel del servicio → *Deployments* → un despliegue anterior → *Rollback*. Las migraciones **no** se revierten solas: diseña las migraciones para ser compatibles hacia atrás.

## 9. Copias de seguridad
- **Base de datos:** activa los backups del servicio Postgres en el panel (según tu plan) y, además, haz copias propias: `export DATABASE_PUBLIC_URL=...` (variable del servicio Postgres) y `./scripts/backup-railway.sh`. Guarda el archivo **fuera de Railway**.
- **Fotos:** configura backups del volumen de `api` en el panel (según plan) o descárgalas con la CLI de Railway (`railway volume files`; revisa `railway volume --help`).
- **Prueba de restauración:** restaura una copia en un proyecto de pruebas al menos una vez antes de tener usuarias reales: `gunzip -c copia.sql.gz | psql "$URL_DE_PRUEBAS"`.

## 10. Límites conocidos
- **Una sola instancia de `api`** (las fotos viven en un volumen y los límites de intentos están en memoria). No actives réplicas.
- Un volumen implica una breve interrupción de `api` en cada despliegue.
- Las fotos en disco no escalan a varios servidores; si se necesita, implementar almacenamiento S3 (la interfaz ya está aislada en `StorageService`).
- Railway deja de leer `railway.json`/`railway.toml` el 2026-12-01 (config como código en desuso), por eso toda la configuración está en el panel y en variables, no en esos archivos.
- Datos de salud: define la política de tratamiento de datos (Ley 1581) y elige región (EE. UU. o UE) conscientemente; ver `docs/SEGURIDAD.md`.
