# Build multi-stage. Explicación completa: ARCHITECTURE_NOTES.md, sección 3.

# --- base: punto de partida compartido ---
FROM node:24-slim AS base
WORKDIR /app
RUN corepack enable

# --- deps: instala paquetes, se cachea mientras package.json/lockfile no cambien ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @routine-tracker/web...

# --- dev: reusa "deps", corre el dev server de Vite directamente — lo usa
# docker-compose.override.yml junto con Compose Watch. No se usa en producción. ---
FROM deps AS dev
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["pnpm", "dev"]

# --- build: copia el código fuente, compila TS y bundlea con Vite -> archivos estáticos en dist/ ---
FROM deps AS build
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
RUN pnpm --filter @routine-tracker/web build

# --- runtime: acá no hay Node para nada. Una app de React compilada es
# HTML/CSS/JS plano, solo necesita un servidor de archivos estáticos —
# nginx, no la imagen de Node. ---
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
