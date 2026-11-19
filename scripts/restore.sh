#!/usr/bin/env bash
# Restaura un respaldo creado con backup.sh. SOBRESCRIBE los datos actuales.
# Uso:  ./scripts/restore.sh neo-db-AAAAMMDD-HHMMSS.sql.gz [neo-fotos-AAAAMMDD-HHMMSS.tar.gz]
# Pruébalo periódicamente en un servidor de prueba: un respaldo que nunca se restauró no es una garantía.
set -euo pipefail

DB_FILE="${1:?Indica el archivo .sql.gz de la base de datos}"
PHOTOS_FILE="${2:-}"
COMPOSE="${COMPOSE:-docker compose --env-file .env.production -f docker-compose.prod.yml}"

read -r -p "Esto reemplaza la base de datos${PHOTOS_FILE:+ y las fotos} actuales. Escribe RESTAURAR para continuar: " ok
[ "$ok" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

echo "→ Deteniendo la API"
$COMPOSE stop api web

echo "→ Recreando la base de datos"
$COMPOSE exec -T postgres psql -U neo -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS neo WITH (FORCE);" -c "CREATE DATABASE neo OWNER neo;"
gunzip -c "$DB_FILE" | $COMPOSE exec -T postgres psql -U neo -d neo -v ON_ERROR_STOP=1 -q

if [ -n "$PHOTOS_FILE" ]; then
  echo "→ Restaurando fotos"
  $COMPOSE run --rm --no-deps -T --entrypoint sh api -c 'rm -rf /data/storage/* && tar -C /data/storage -xz' < "$PHOTOS_FILE"
fi

echo "→ Levantando de nuevo"
$COMPOSE up -d
echo "Restauración terminada."
