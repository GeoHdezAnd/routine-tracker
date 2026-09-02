// One-off/rerunnable maintenance script: translates the English exercise
// names that prisma:backfill-images inserted (as new global exercises,
// straight from the free-exercise-db catalog) into Spanish, matching the
// language of the curated wger seed catalog.
//
//   pnpm --filter @routine-tracker/api prisma:translate-names
//
// What it does:
//  1. Loads the static English->Spanish translation map (translations.json),
//     built by hand-translating the full free-exercise-db catalog (862
//     entries as of writing) into gym-appropriate Latin American Spanish,
//     following the style of prisma/seed-data/wger-exercises.json.
//  2. For every global exercise (ownerId: null) whose current name matches
//     an entry in that map (i.e. it's still holding the raw English name
//     from insertion), updates it to the Spanish translation.
//  3. Rows whose name doesn't match any map entry are left untouched —
//     that's either an exercise already in Spanish (matched/updated by
//     prisma:backfill-images via the wger seed's nameEn fallback) or
//     something outside this catalog entirely.
//  4. Idempotent: once a row is translated, its name no longer matches the
//     English map, so a second run naturally skips it — no flag needed.
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { normalizeName } from "./exercise-db-mapping.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRANSLATIONS_PATH = path.join(__dirname, "seed-data", "exercise-name-translations.json");

function loadTranslationsByNormalizedName(): Map<string, string> {
  const raw = readFileSync(TRANSLATIONS_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, string>;
  const map = new Map<string, string>();
  for (const [english, spanish] of Object.entries(parsed)) {
    map.set(normalizeName(english), spanish);
  }
  return map;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const translationsByNormalizedName = loadTranslationsByNormalizedName();
    console.log(`Loaded ${translationsByNormalizedName.size} English->Spanish exercise name translations.`);

    const globalExercises = await prisma.exercise.findMany({
      where: { ownerId: null },
      select: { id: true, name: true },
    });

    let translated = 0;
    let skippedAlreadySpanish = 0;
    let skippedNoMapping = 0;

    for (const exercise of globalExercises) {
      const spanishName = translationsByNormalizedName.get(normalizeName(exercise.name));
      if (!spanishName) {
        skippedAlreadySpanish += 1;
        continue;
      }
      if (!spanishName.trim()) {
        console.error(`No mapping value for "${exercise.name}" — skipping rather than writing a blank name.`);
        skippedNoMapping += 1;
        continue;
      }

      await prisma.exercise.update({ where: { id: exercise.id }, data: { name: spanishName } });
      translated += 1;
      console.log(`translated: "${exercise.name}" -> "${spanishName}"`);
    }

    console.log(
      `Done. ${translated} translated, ${skippedAlreadySpanish} already Spanish (skipped), ` +
        `${skippedNoMapping} skipped (no mapping).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Translation failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
