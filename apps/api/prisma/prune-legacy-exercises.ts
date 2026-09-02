// One-off maintenance script: removes the original ~95-exercise curated wger
// seed catalog entries that free-exercise-db never found a photo for (i.e.
// prisma:backfill-images left them with no imageUrl) — now that
// free-exercise-db covers the strength-training catalog with real photos,
// these unmatched legacy rows are redundant. Only deletes rows that are safe
// to delete; never touches anything referenced by real user data.
//
//   pnpm --filter @routine-tracker/api prisma:prune-legacy-exercises
//
// Safety rules per candidate row:
//  - Referenced by a SetLog (a logged set) -> hard-blocked. Deleting it would
//    violate the SetLog.exercise onDelete: Restrict FK anyway; reported only.
//  - Referenced by a RoutineExercise (used in a routine) -> soft-blocked.
//    Deleting would cascade and silently drop it from that routine, so this
//    script never does that automatically; reported for manual review.
//  - Otherwise -> safe to delete.
//
// This script never touches exercises outside the curated wger seed list
// (e.g. leaked test-fixture rows) — those are flagged as informational only.
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { normalizeName } from "./exercise-db-mapping.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DATA_PATH = path.join(__dirname, "seed-data", "wger-exercises.json");

type SeedExercise = { name: string };
type SeedFile = { exercises: SeedExercise[] };

function loadWgerSeedNamesNormalized(): Set<string> {
  const raw = readFileSync(SEED_DATA_PATH, "utf-8");
  const parsed = JSON.parse(raw) as SeedFile;
  return new Set(parsed.exercises.map((exercise) => normalizeName(exercise.name)));
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const wgerSeedNamesNormalized = loadWgerSeedNamesNormalized();

    const noImageExercises = await prisma.exercise.findMany({
      where: { ownerId: null, imageUrl: null },
      select: { id: true, name: true },
    });

    const legacyCandidates = noImageExercises.filter((exercise) =>
      wgerSeedNamesNormalized.has(normalizeName(exercise.name)),
    );
    const nonCatalogRows = noImageExercises.filter(
      (exercise) => !wgerSeedNamesNormalized.has(normalizeName(exercise.name)),
    );

    console.log(
      `${noImageExercises.length} global exercise(s) have no imageUrl; ` +
        `${legacyCandidates.length} match the legacy wger seed catalog and will be evaluated for deletion.`,
    );

    let deleted = 0;
    const blockedBySetLog: string[] = [];
    const blockedByRoutineExercise: string[] = [];

    for (const exercise of legacyCandidates) {
      const [setLogCount, routineExerciseCount] = await Promise.all([
        prisma.setLog.count({ where: { exerciseId: exercise.id } }),
        prisma.routineExercise.count({ where: { exerciseId: exercise.id } }),
      ]);

      if (setLogCount > 0) {
        blockedBySetLog.push(exercise.name);
        continue;
      }
      if (routineExerciseCount > 0) {
        blockedByRoutineExercise.push(exercise.name);
        continue;
      }

      await prisma.exercise.delete({ where: { id: exercise.id } });
      deleted += 1;
      console.log(`deleted: "${exercise.name}"`);
    }

    console.log(`\nDone. ${deleted} deleted.`);

    if (blockedBySetLog.length > 0) {
      console.log(
        `\n${blockedBySetLog.length} exercise(s) blocked — logged sets reference them (SetLog is Restrict, can't delete):`,
      );
      for (const name of blockedBySetLog) console.log(`  - ${name}`);
    }

    if (blockedByRoutineExercise.length > 0) {
      console.log(
        `\n${blockedByRoutineExercise.length} exercise(s) blocked — used in a routine (deleting would cascade ` +
          "and silently remove them from it, so this script leaves them for you to reassign or delete manually):",
      );
      for (const name of blockedByRoutineExercise) console.log(`  - ${name}`);
    }

    if (nonCatalogRows.length > 0) {
      console.log(
        `\n${nonCatalogRows.length} unrelated non-catalog exercise(s) with no image were not evaluated ` +
          "(likely leaked test data, not part of this cleanup):",
      );
      for (const exercise of nonCatalogRows) console.log(`  - ${exercise.name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Prune failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
