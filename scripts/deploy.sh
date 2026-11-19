#!/usr/bin/env bash
# Actualiza el servidor: respalda, trae el código, reconstruye y verifica la salud.
# Uso (en el servidor, dentro de /opt/neo):  ./scripts/deploy.sh [rama]
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="${1:-main}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.production)

[ -f .env.production ] || { echo "Falta .env.production"; exit 1; }

echo "==> Backup previo"
./scripts/backup.sh

PREV="$(git rev-parse HEAD)"
echo "==> Actualizando código ($BRANCH)"
git fetch --prune origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> Reconstruyendo y levantando"
"${COMPOSE[@]}" up -d --build

DOMAIN="$(grep -E '^(DOMAIN|WEB_ORIGIN)=' .env.production | head -1 | cut -d= -f2- | sed 's|^https\?://||')"
echo "==> Verificando salud en https://$DOMAIN/api/v1/health"
for i in $(seq 1 30); do
  if curl -fsS "https://$DOMAIN/api/v1/health" | grep -q '"database":"up"'; then
    echo "OK: despliegue completado ($(git rev-parse --short HEAD))"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 4
done

echo "ERROR: la API no respondió sana. Para volver atrás:"
echo "  git checkout $PREV && ${COMPOSE[*]} up -d --build"
"${COMPOSE[@]}" logs --tail=60 api || true
exit 1
