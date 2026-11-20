# Neo — Guía de despliegue

Despliegue en un único servidor Linux con Docker Compose: **Caddy** (HTTPS automático) + **API NestJS** + **PostgreSQL**. Los archivos están en `docker-compose.prod.yml`, `deploy/` y `scripts/`.

> ¿Prefieres no administrar un servidor? Ver la alternativa en Railway: [`RAILWAY.md`](RAILWAY.md).

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

## 8. Montar el servidor desde cero (VPS)
Probado conceptualmente para Hetzner, DigitalOcean, Vultr o Lightsail: cualquier Ubuntu 24.04 con 2 vCPU / 4 GB sirve. Elige región EE. UU. si tus usuarias están en Colombia.

1. **Crear el servidor** con tu llave SSH pública. Anota la IP.
2. **DNS**: registro **A** `neo.tudominio.com` → IP del servidor.
3. **Acceso seguro** (como root, una sola vez):
   ```bash
   adduser deploy && usermod -aG sudo deploy
   rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
   sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/; s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
   systemctl restart ssh
   ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
   apt update && apt -y upgrade && apt -y install unattended-upgrades fail2ban
   ```
4. **Docker** (como `deploy`): `curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker deploy` y vuelve a entrar.
5. **Código**: `sudo mkdir -p /opt/neo && sudo chown deploy /opt/neo && git clone <repo> /opt/neo`. Si el repo es privado, usa una *deploy key* de solo lectura.
6. Sigue la sección 2 (`.env.production`, `up -d --build`) y la 3 (verificación).
7. **Backups**: cron diario de la sección 5 y copia externa (rclone a otro proveedor).
8. **Monitoreo**: UptimeRobot sobre `/api/v1/health`.

## 9. Actualizar con un comando: `scripts/deploy.sh`
En el servidor: `./scripts/deploy.sh` hace backup, `git pull`, reconstruye, espera a que `/api/v1/health` responda `database: up` y, si falla, imprime los logs y el comando para volver atrás.

## 10. Despliegue automático desde GitHub (opcional)
`deploy.yml` (ponlo en `.github/workflows/`) ejecuta `scripts/deploy.sh` por SSH al pulsar *Run workflow* o al publicar una etiqueta `v*`.
1. En el repo: *Settings → Environments → New environment* `production` (activa *Required reviewers* si quieres aprobar cada despliegue).
2. En ese entorno agrega los secretos `DEPLOY_HOST` (IP o dominio), `DEPLOY_USER` (`deploy`) y `DEPLOY_SSH_KEY` (llave privada **dedicada**, cuya pública agregas a `~deploy/.ssh/authorized_keys`).
3. Flujo recomendado: CI en verde en `main` → `git tag v1.0.0 && git push --tags` → se despliega.
