import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { normalizeExercise, type RawExercise } from "./exercise-normalize.js";

interface SeedFile {
  meta: Record<string, unknown>;
  exercises: RawExercise[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DATA_PATH = path.join(__dirname, "seed-data", "simplyfitness.json");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const parsed = JSON.parse(readFileSync(SEED_DATA_PATH, "utf-8")) as SeedFile;
    if (!Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      throw new Error(`No exercises found in ${SEED_DATA_PATH}`);
    }
    const exercises = parsed.exercises.map(normalizeExercise);

    // Idempotent: upsert by slug. Catalog rows are global (ownerId: null) and
    // keyed by slug, which user-created exercises never have, so user-owned
    // rows are never matched or modified.
    for (const exercise of exercises) {
      await prisma.exercise.upsert({
        where: { slug: exercise.slug },
        create: { ...exercise, ownerId: null },
        update: exercise,
      });
    }
    console.log(`Upserted ${exercises.length} global exercise(s) from ${SEED_DATA_PATH}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
