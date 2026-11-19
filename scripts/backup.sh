#!/usr/bin/env bash
# RNF-15: respaldo de la base de datos y de las fotos del diario.
# Uso (en el servidor, desde la raíz del repo):  ./scripts/backup.sh [carpeta-destino]
# Genera neo-db-AAAAMMDD-HHMMSS.sql.gz y neo-fotos-AAAAMMDD-HHMMSS.tar.gz y borra los de más de RETENTION_DAYS días (30 por defecto).
# Programa con cron, p. ej. todos los días a las 2 am:  0 2 * * * cd /ruta/neo && ./scripts/backup.sh /var/backups/neo
# Guarda también una copia FUERA del servidor (otro proveedor o disco): un respaldo en la misma máquina no cubre su pérdida.
set -euo pipefail

DEST="${1:-./backups}"
COMPOSE="${COMPOSE:-docker compose --env-file .env.production -f docker-compose.prod.yml}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$DEST"
umask 077

echo "→ Base de datos"
$COMPOSE exec -T postgres pg_dump -U neo -d neo --no-owner | gzip > "$DEST/neo-db-$STAMP.sql.gz"

echo "→ Fotos"
$COMPOSE exec -T api tar -C /data/storage -cz . > "$DEST/neo-fotos-$STAMP.tar.gz"

# Un respaldo vacío o truncado es peor que ninguno: se verifica que se pueda leer.
gzip -t "$DEST/neo-db-$STAMP.sql.gz"
gzip -t "$DEST/neo-fotos-$STAMP.tar.gz"

find "$DEST" -maxdepth 1 \( -name 'neo-db-*.sql.gz' -o -name 'neo-fotos-*.tar.gz' \) -mtime +"$RETENTION_DAYS" -delete
echo "Listo: $DEST/neo-db-$STAMP.sql.gz y $DEST/neo-fotos-$STAMP.tar.gz"
