# Imagen de la API. Se construye desde la raíz del repo:
#   docker build -f apps/api/Dockerfile -t neo-api .
FROM node:22-bookworm-slim AS build
# openssl lo necesita el motor de Prisma; las herramientas de compilación, por si argon2 no encuentra binario precompilado.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/web/package.json ./apps/web/package.json
# El postinstall compila los paquetes compartidos y genera el cliente de Prisma.
RUN npm ci
RUN npm run build -w @neo/api

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    STORAGE_DIR=/data/storage
WORKDIR /app/apps/api
COPY --from=build --chown=node:node /app /app
# El volumen de fotos hereda este dueño al crearse por primera vez.
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3000)+'/api/v1/health').then(r=>r.json()).then(j=>process.exit(j.data&&j.data.database?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
