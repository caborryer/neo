#!/usr/bin/env bash
# Copia lógica de la base de datos de Railway a un archivo comprimido en TU computador.
# Requisitos: pg_dump (cliente de PostgreSQL 16) y la URL PÚBLICA de la base (servicio Postgres → Variables → DATABASE_PUBLIC_URL).
#   export DATABASE_PUBLIC_URL='postgresql://...'
#   ./scripts/backup-railway.sh [carpeta-destino]
# Guarda la copia fuera de Railway (disco externo, nube). Las fotos se respaldan aparte (ver docs/RAILWAY.md).
set -euo pipefail

: "${DATABASE_PUBLIC_URL:?Define DATABASE_PUBLIC_URL (Postgres en Railway → Variables)}"
DEST="${1:-./backups}"
mkdir -p "$DEST"
FILE="$DEST/neo-db-$(date +%Y%m%d-%H%M%S).sql.gz"

pg_dump --no-owner --no-privileges "$DATABASE_PUBLIC_URL" | gzip -9 > "$FILE"

# Verificación mínima: el archivo descomprime y contiene el esquema.
gzip -t "$FILE"
zcat "$FILE" | grep -q 'CREATE TABLE' || { echo "ERROR: la copia no contiene tablas"; rm -f "$FILE"; exit 1; }
echo "OK: $FILE ($(du -h "$FILE" | cut -f1))"
