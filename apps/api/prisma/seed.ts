import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

type MovementType = "COMPOUND" | "ISOLATION";

interface SeedExercise {
  name: string;
  muscleGroup: string;
  equipmentType: string;
  movementType: MovementType;
}

interface SeedFile {
  meta: Record<string, unknown>;
  exercises: SeedExercise[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DATA_PATH = path.join(__dirname, "seed-data", "wger-exercises.json");

function loadCuratedExercises(): SeedExercise[] {
  const raw = readFileSync(SEED_DATA_PATH, "utf-8");
  const parsed = JSON.parse(raw) as SeedFile;

  // Strip provenance metadata (_source) — it's for maintainers reading the
  // JSON file, not part of the Exercise model and never written to the DB.
  return parsed.exercises.map(({ name, muscleGroup, equipmentType, movementType }) => ({
    name,
    muscleGroup,
    equipmentType,
    movementType,
  }));
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const exercises = loadCuratedExercises();

    // Global catalog exercises are identified by ownerId: null. There is no
    // externalId to upsert against (deliberately not added to the schema —
    // this is a one-off seed, not a live sync), so the simplest idempotent
    // strategy is: wipe every global exercise and reinsert the curated set
    // fresh on each run. This never touches rows with a non-null ownerId
    // (real users' custom exercises).
    const deleted = await prisma.exercise.deleteMany({ where: { ownerId: null } });
    console.log(`Deleted ${deleted.count} existing global exercise(s).`);

    const created = await prisma.exercise.createMany({
      data: exercises.map((exercise) => ({ ...exercise, ownerId: null })),
    });
    console.log(`Inserted ${created.count} global exercise(s) from ${SEED_DATA_PATH}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
