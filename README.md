# Routine Tracker

Un tracker personal de rutinas de gimnasio: registrá tus entrenamientos
serie por serie (peso, reps, RIR) y seguí tu progreso en el tiempo.

## Stack

- **API**: Node, Express, TypeScript, Prisma 7, PostgreSQL, JWT
- **Web**: React, Vite, TypeScript, Tailwind CSS
- **Monorepo**: pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`)
- **DevOps**: Docker, GitHub Actions (CI)

## Requisitos

- Node 24 (`.nvmrc` — `nvm use`)
- pnpm (`corepack enable`)
- Docker + Docker Compose

## Setup

```bash
nvm use
pnpm install
```

Creá `apps/api/.env`:

```
DATABASE_URL="postgresql://routine_tracker:routine_tracker@localhost:5433/routine_tracker"
JWT_SECRET=""
PORT=3000
```

## Levantar el proyecto

Con Docker (recomendado):

```bash
docker compose watch
```

Levanta `postgres`, `api` (`:3000`) y `web` (`:5173`) con recarga en
caliente — no necesitás nada instalado más que Docker.

Sin Docker:

```bash
pnpm dev:api   # :3000
pnpm dev:web   # :5173
```

## Base de datos: migraciones y seed

La primera vez que levantás el proyecto (o cuando bajás una migración
nueva) hay que aplicar el schema y, opcionalmente, poblar el catálogo de
ejercicios globales. `postgres` tiene que estar arriba y healthy antes de
correr esto.

Con Docker:

```bash
docker compose exec api pnpm exec prisma migrate deploy
docker compose exec api pnpm run prisma:seed
```

Sin Docker (con `apps/api/.env` configurado y `nvm use` ya corrido):

```bash
pnpm --filter @routine-tracker/api prisma:migrate
pnpm --filter @routine-tracker/api prisma:seed
```

`prisma:seed` carga ~95 ejercicios en español (catálogo curado desde la
API de [wger.de](https://wger.de), snapshot versionado en
`apps/api/prisma/seed-data/wger-exercises.json`, sin depender de red en
tiempo de build/CI) con `ownerId: null` (visibles para cualquier usuario,
no editables). Es idempotente — cada corrida borra los ejercicios
globales existentes y reinserta el set curado desde cero, sin tocar
ejercicios custom de usuarios reales (`ownerId` no nulo).

## Scripts

| Comando           | Descripción                              |
| ------------------ | ----------------------------------------- |
| `pnpm lint`        | Lintea todos los paquetes                 |
| `pnpm typecheck`   | Chequea tipos en todos los paquetes       |
| `pnpm test`        | Corre los tests                           |
| `pnpm build`       | Buildea todos los paquetes                |
