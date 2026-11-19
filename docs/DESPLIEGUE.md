# Neo — Guía de despliegue

Despliegue en un único servidor Linux con Docker Compose: **Caddy** (HTTPS automático) + **API NestJS** + **PostgreSQL**. Los archivos están en `docker-compose.prod.yml`, `deploy/` y `scripts/`.

> Estos artefactos se validaron estáticamente (`docker compose config`, `bash -n`). Haz el primer despliegue en un servidor de pruebas antes de usar el real.

## 1. Requisitos
- VPS con 2 GB de RAM, Docker Engine + plugin Compose.
- Un dominio (ej. `neo.tudominio.com`) con registro **A** apuntando a la IP del servidor.
- Puertos 80 y 443 abiertos (Caddy necesita ambos para obtener el certificado).
- Un servidor SMTP real (Brevo, SES, Mailgun, etc.) para invitaciones y recuperación de contraseña.

## 2. Primer despliegue
```bash
git clone <repo> neo && cd neo
cp deploy/env.production.example .env.production
nano .env.production      # completa TODO; genera secretos con: openssl rand -hex 32
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
Al arrancar: PostgreSQL → `migrate` (aplica `prisma migrate deploy` y termina) → `api` → `web` (Caddy). La API **se niega a arrancar** en producción si detecta secretos de ejemplo, secretos iguales, `WEB_ORIGIN` sin https o `COOKIE_SECURE=false`.

Requisito: `apps/api/prisma/migrations` debe estar commiteado en el repositorio.

### Crear la Coach
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \
  -e SEED_COACH_EMAIL=coach@tudominio.com -e SEED_COACH_PASSWORD='ClaveLarga123!' \
  api npx ts-node prisma/seed.ts
```
Si el seed no está disponible en la imagen de producción, ejecútalo una vez desde tu equipo apuntando a la base (túnel SSH al puerto de PostgreSQL). Cambia la clave en el primer inicio de sesión.

## 3. Verificación
- `https://neo.tudominio.com` carga y muestra el login.
- `https://neo.tudominio.com/api/v1/health` responde `{"data":{"database":"up",...}}`.
- Inicia sesión como Coach y crea una usuaria de prueba: debe llegar el correo de invitación.
- `docker compose -f docker-compose.prod.yml ps` → `api` y `web` en estado *healthy/running*.

## 4. Actualizar
```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
Las migraciones se aplican solas. Haz un backup antes de actualizar si hay migraciones nuevas.

## 5. Copias de seguridad
`scripts/backup.sh` genera un `pg_dump` comprimido y un `tar` de las fotos, verifica la integridad y borra copias de más de 30 días.
```bash
./scripts/backup.sh                         # manual
0 3 * * * cd /opt/neo && ./scripts/backup.sh >> /var/log/neo-backup.log 2>&1   # cron diario
```
Copia los archivos fuera del servidor (rclone, rsync o S3): una copia en el mismo disco no es un respaldo.

**Restaurar:** `./scripts/restore.sh <archivo.sql.gz> [fotos.tar.gz]` (pide escribir `RESTAURAR`; sobrescribe la base). **Prueba una restauración en un servidor de pruebas al menos una vez.**

## 6. Operación
- Logs: `docker compose -f docker-compose.prod.yml logs -f api` (una línea por petición con `X-Request-Id`; no registra cuerpos, cookies ni cabeceras).
- Variables operativas: `TRUST_PROXY=1` (Caddy), `HTTP_LOG`, `SMTP_*`.
- `DISABLE_RATE_LIMIT` es solo para E2E y la API la rechaza en producción.

## 7. Pendientes conocidos
- Las fotos se guardan en disco (volumen `storage`). Si se necesita escalar a varios servidores, implementar el driver S3 (la interfaz de almacenamiento ya está aislada).
- Optimización/redimensionado de imágenes (RNF-08) no está implementada; el límite de subida es 5 MB.
- Recordatorios: solo se guarda la preferencia; no hay envío automático.
- Sin monitoreo externo: configura un chequeo (UptimeRobot o similar) sobre `/api/v1/health`.
