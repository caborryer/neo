# Web estática servida por Caddy (HTTPS automático) que también reenvía /api a la API.
#   docker build -f apps/web/Dockerfile -t neo-web .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY apps/api/package.json ./apps/api/package.json
# Sin scripts: la web no necesita el cliente de Prisma; los paquetes compartidos se compilan a mano.
RUN npm ci --ignore-scripts && npm run build:packages
RUN npm run build -w @neo/web

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
EXPOSE 80 443
