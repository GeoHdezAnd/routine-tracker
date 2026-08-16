# Multi-stage build. Full walkthrough: ARCHITECTURE_NOTES.md, section 3.

# --- base: OS-level deps shared by every other stage ---
FROM node:24-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# --- deps: install packages, cached as long as package.json/lockfile don't change ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @routine-tracker/api...

# --- dev: reuses "deps" (already has devDependencies installed), runs the
# watch server directly instead of compiling — used by docker-compose.override.yml
# together with Compose Watch. Not used in production. ---
FROM deps AS dev
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
WORKDIR /app/apps/api
CMD ["pnpm", "dev"]

# --- build: now copy source and compile ---
FROM deps AS build
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
# prisma generate only reads the schema, it never connects — this placeholder
# satisfies prisma.config.ts's env() check at build time.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5433/placeholder"
RUN pnpm --filter @routine-tracker/api prisma:generate
RUN pnpm --filter @routine-tracker/api build

# --- runtime: starts fresh from "base", not "build" — no TypeScript, no
# devDependencies, no source .ts files, just the compiled output ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/node_modules ./node_modules
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/index.js"]
