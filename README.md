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

`prisma:seed` carga 143 ejercicios en español con guía (posición inicial,
ejecución, equipo y músculos) desde un snapshot de simplyfitness.com
versionado en `apps/api/prisma/seed-data/simplyfitness.json` (sin red en
tiempo de build/CI). Los valores se normalizan con
`apps/api/prisma/exercise-normalize.ts`. Los ejercicios son globales
(`ownerId: null`) y el seed es idempotente: hace upsert por `slug`, sin
tocar ejercicios custom de usuarios (`ownerId` no nulo).

Flujo cuando se regenera el catálogo (scrape -> imágenes -> seed):

```bash
pnpm --filter @routine-tracker/api prisma:scrape-exercises
pnpm --filter @routine-tracker/api prisma:upload-exercise-images
pnpm --filter @routine-tracker/api prisma:seed
```

`prisma:upload-exercise-images` sube cada imagen a tu Cloudinary
(`gytracker/exercises/<slug>`, requiere `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` en `apps/api/.env`) y
reescribe `imageUrl` en el JSON, guardando el original en `sourceImageUrl`.
Es idempotente (reusa lo ya subido); con `--force` (`... prisma:upload-exercise-images -- --force`) sobrescribe los assets existentes desde `sourceImageUrl` e invalida el caché del CDN. El seed usa `imageUrl`, así que
cualquier base (local o QA) queda con URLs de Cloudinary sin pasos extra.

Para ver la UI con datos realistas en local (solo dev, rechaza hosts no
locales y `NODE_ENV=production`; requiere el catálogo ya cargado):

```bash
pnpm --filter @routine-tracker/api prisma:seed-demo
```

Crea el usuario `demo@routine-tracker.dev` / `demo12345` con 4 rutinas y
~8 semanas de sesiones con sobrecarga progresiva. Es idempotente: borra y
recrea solo los datos de ese usuario.


## Scripts

| Comando           | Descripción                              |
| ------------------ | ----------------------------------------- |
| `pnpm lint`        | Lintea todos los paquetes                 |
| `pnpm typecheck`   | Chequea tipos en todos los paquetes       |
| `pnpm test`        | Corre los tests                           |
| `pnpm build`       | Buildea todos los paquetes                |
