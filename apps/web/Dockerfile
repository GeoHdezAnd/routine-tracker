# Multi-stage build. Full walkthrough: ARCHITECTURE_NOTES.md, section 3.

# --- base: shared starting point ---
FROM node:24-slim AS base
WORKDIR /app
RUN corepack enable

# --- deps: install packages, cached as long as package.json/lockfile don't change ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @routine-tracker/web...

# --- dev: reuses "deps", runs the Vite dev server directly — used by
# docker-compose.override.yml together with Compose Watch. Not used in production. ---
FROM deps AS dev
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["pnpm", "dev"]

# --- build: copy source, compile TS and bundle with Vite -> static files in dist/ ---
FROM deps AS build
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
RUN pnpm --filter @routine-tracker/web build

# --- runtime: no Node here at all. A compiled React app is plain HTML/CSS/JS,
# so it just needs a static file server — nginx, not the Node image. ---
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
