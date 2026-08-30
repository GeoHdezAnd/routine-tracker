# Build multi-stage.

# --- base: dependencias de sistema operativo compartidas por el resto de los stages ---
FROM node:24-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# --- deps: instala paquetes, se cachea mientras package.json/lockfile no cambien ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @routine-tracker/api...

# --- dev: reusa "deps" (ya tiene las devDependencies instaladas), corre el
# servidor con watch en vez de compilar — lo usa docker-compose.override.yml
# junto con Compose Watch. No se usa en producción. ---
FROM deps AS dev
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
WORKDIR /app/apps/api
# prisma generate corre acá (no en build-time de la imagen) porque recién en
# el arranque del contenedor tenemos el DATABASE_URL real de docker-compose.yml.
CMD ["sh", "-c", "pnpm exec prisma generate && pnpm dev"]

# --- build: ahora sí copia el código fuente y compila ---
FROM deps AS build
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
# prisma generate solo lee el schema, nunca se conecta — este placeholder
# satisface el chequeo de env() de prisma.config.ts en tiempo de build.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5433/placeholder"
RUN pnpm --filter @routine-tracker/api prisma:generate
RUN pnpm --filter @routine-tracker/api build
# packages/shared/package.json apunta a src/index.ts a propósito, para que
# tsx (dev) y Vite lo transpilen al vuelo sin build ni hot-reload roto. El
# runtime de producción es "node dist/index.js" puro, sin transpiler, así
# que acá (y SOLO acá, en la imagen) lo compilamos a JS y reapuntamos
# main/types al output — el package.json del repo/dev queda intacto.
RUN pnpm --filter @routine-tracker/shared build
RUN cd packages/shared && npm pkg set main=dist/index.js types=dist/index.d.ts

# --- runtime: arranca de nuevo desde "base", no desde "build" — sin TypeScript,
# sin devDependencies, sin los .ts fuente, solo el output compilado ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
WORKDIR /app/apps/api
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
