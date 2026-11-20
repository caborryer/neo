#!/bin/sh
# Entrypoint de la imagen de la API.
#  1) Si arranca como root (lo normal): deja el directorio de fotos con el dueño correcto y baja a "node".
#     Railway monta los volúmenes como root, así que un proceso no-root no podría escribir en ellos.
#  2) Opcional (variables de entorno): aplica migraciones (RUN_MIGRATIONS=true) y crea la Coach inicial (RUN_SEED=true).
#  3) Ejecuta el comando recibido (por defecto: node dist/main.js).
set -e

if [ "$(id -u)" = "0" ]; then
  STORAGE="${STORAGE_DIR:-/data/storage}"
  mkdir -p "$STORAGE"
  # Solo toca lo que aún no es de "node": instantáneo cuando ya está bien (no recorre miles de fotos en cada arranque).
  find "$STORAGE" -not -user node -exec chown node:node {} +
  exec env HOME=/home/node setpriv --reuid=node --regid=node --init-groups /usr/local/bin/neo-entrypoint "$@"
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] Aplicando migraciones..."
  npx prisma migrate deploy
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[entrypoint] Creando la Coach inicial (no hace nada si ya existe una)..."
  npx ts-node prisma/seed.ts
fi

exec "$@"
