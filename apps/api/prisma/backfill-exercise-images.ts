// One-off/rerunnable maintenance script: backfills Exercise.imageUrl from
// free-exercise-db's exercise photographs, uploaded to Cloudinary.
//
//   pnpm --filter @routine-tracker/api prisma:backfill-images
//
// What it does:
//  1. Fetches the full free-exercise-db catalog (dist/exercises.json, a
//     single static JSON file — no rate limit).
//  2. For each DB exercise missing an imageUrl, tries to match it to a
//     catalog entry (by name, with a Spanish->English fallback via the
//     curated seed data) and backfills its image.
//  3. For catalog entries with no matching DB exercise, imports them as new
//     global exercises (ownerId: null) with their catalog image.
//  4. Idempotent: rows that already have an imageUrl are skipped, so a
//     partial/interrupted run can simply be re-run later to pick up where it
//     left off.
//  5. Prints the names of any DB exercises that still have no imageUrl after
//     the run (no free-exercise-db match found), for manual review — this
//     script never deletes or otherwise decides the fate of those rows.
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { assertCloudinaryConfigured, uploadExerciseImage } from "./cloudinary-client.js";
import { fetchFullCatalog, resolveImageUrl } from "./exercise-db-client.js";
import {
  findCatalogMatch,
  mapEquipmentType,
  mapMuscleGroup,
  normalizeName,
  resolveMovementType,
  type ExerciseDbEntry,
} from "./exercise-db-mapping.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DATA_PATH = path.join(__dirname, "seed-data", "wger-exercises.json");

// free-exercise-db's exercises.json is a single static file with no rate
// limit, and Cloudinary's uploader fetches the source image server-side, so
// there's no per-request quota to respect here like Anatome's old 50/day
// generateImage limit. Still keep a small polite delay between requests so
// we don't hammer Cloudinary's free-tier upload throughput.
const REQUEST_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type SeedExercise = { name: string; _source?: { nameEn?: string } };
type SeedFile = { exercises: SeedExercise[] };

/** Spanish (normalized) exercise name -> English name, from the curated seed data. */
function loadNameEnMap(): Map<string, string> {
  const raw = readFileSync(SEED_DATA_PATH, "utf-8");
  const parsed = JSON.parse(raw) as SeedFile;
  const map = new Map<string, string>();
  for (const exercise of parsed.exercises) {
    if (exercise._source?.nameEn) {
      map.set(normalizeName(exercise.name), exercise._source.nameEn);
    }
  }
  return map;
}

type UpdateJob = { kind: "update"; exerciseId: string; dbName: string; entry: ExerciseDbEntry };
type InsertJob = { kind: "insert"; entry: ExerciseDbEntry };
type Job = UpdateJob | InsertJob;

async function main() {
  assertCloudinaryConfigured();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Fetching free-exercise-db catalog...");
    const catalog = await fetchFullCatalog();
    console.log(`Fetched ${catalog.length} free-exercise-db catalog entries.`);

    const nameEnBySpanishName = loadNameEnMap();

    const existingExercises = await prisma.exercise.findMany({
      select: { id: true, name: true, imageUrl: true },
    });
    const alreadyImagedCount = existingExercises.filter((exercise) => exercise.imageUrl).length;
    console.log(`${alreadyImagedCount} existing exercise(s) already have an image (skipped).`);

    const existingNamesNormalized = new Set(existingExercises.map((exercise) => normalizeName(exercise.name)));

    const updateJobs: UpdateJob[] = [];
    const matchedIds = new Set<string>();
    const unmatchedExerciseNames: string[] = [];
    for (const exercise of existingExercises) {
      if (exercise.imageUrl) continue;
      const match = findCatalogMatch(exercise.name, catalog, nameEnBySpanishName);
      if (match) {
        updateJobs.push({ kind: "update", exerciseId: exercise.id, dbName: exercise.name, entry: match });
        matchedIds.add(match.id);
      } else {
        unmatchedExerciseNames.push(exercise.name);
      }
    }
    console.log(`${updateJobs.length} existing exercise(s) matched to the free-exercise-db catalog.`);

    const insertJobs: InsertJob[] = [];
    for (const entry of catalog) {
      if (matchedIds.has(entry.id)) continue;
      if (!resolveImageUrl(entry)) continue; // skip catalog entries with no photo
      const normalized = normalizeName(entry.name);
      if (existingNamesNormalized.has(normalized)) continue;
      existingNamesNormalized.add(normalized); // avoid inserting duplicates within this same run
      insertJobs.push({ kind: "insert", entry });
    }
    console.log(`${insertJobs.length} free-exercise-db catalog entrie(s) will be imported as new global exercises.`);

    const jobs: Job[] = [...updateJobs, ...insertJobs];
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const job of jobs) {
      const label = job.kind === "update" ? job.dbName : job.entry.name;
      try {
        const sourceUrl = resolveImageUrl(job.entry);
        if (!sourceUrl) {
          throw new Error("catalog entry has no image");
        }
        const imageUrl = await uploadExerciseImage(sourceUrl, job.entry.id);

        if (job.kind === "update") {
          await prisma.exercise.update({ where: { id: job.exerciseId }, data: { imageUrl } });
        } else {
          await prisma.exercise.create({
            data: {
              name: job.entry.name,
              muscleGroup: mapMuscleGroup(job.entry.primaryMuscles),
              equipmentType: mapEquipmentType(job.entry.equipment),
              movementType: resolveMovementType(job.entry),
              imageUrl,
              ownerId: null,
            },
          });
        }
        succeeded += 1;
        console.log(`[${processed + 1}/${jobs.length}] ${job.kind} ok: "${label}"`);
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[${processed + 1}/${jobs.length}] ${job.kind} FAILED: "${label}" — ${message}`);
        if (job.kind === "update") unmatchedExerciseNames.push(job.dbName);
      }

      processed += 1;
      await sleep(REQUEST_DELAY_MS);
    }

    console.log(`Done. ${succeeded} succeeded, ${failed} failed.`);

    if (unmatchedExerciseNames.length > 0) {
      console.log(
        `\n${unmatchedExerciseNames.length} exercise(s) still have no imageUrl (no free-exercise-db match found ` +
          "or the upload failed) — review manually and decide whether to prune, rename, or match by hand:",
      );
      for (const name of unmatchedExerciseNames) {
        console.log(`  - ${name}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Backfill failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
