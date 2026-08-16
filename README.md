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
DATABASE_URL="postgresql://routine_tracker:routine_tracker@localhost:5432/routine_tracker"
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

## Scripts

| Comando           | Descripción                              |
| ------------------ | ----------------------------------------- |
| `pnpm lint`        | Lintea todos los paquetes                 |
| `pnpm typecheck`   | Chequea tipos en todos los paquetes       |
| `pnpm test`        | Corre los tests                           |
| `pnpm build`       | Buildea todos los paquetes                |
