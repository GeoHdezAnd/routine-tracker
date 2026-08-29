import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migraciones necesitan la conexión directa (sin -pooler): PgBouncer en modo
    // transacción no soporta prepared statements ni SET de sesión. Local/CI no
    // tienen pooler, así que caen a DATABASE_URL.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  },
});
