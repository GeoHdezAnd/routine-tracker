// Thin client for free-exercise-db (https://github.com/yuhonas/free-exercise-db,
// Unlicense/public domain). Unlike Anatome — which only renders a generic
// static body silhouette with a colored muscle region (same image for every
// exercise targeting the same muscle group, not the actual movement) —
// free-exercise-db ships real photographs of each specific exercise, which is
// what we actually need for exercise cover images.
import type { ExerciseDbEntry } from "./exercise-db-mapping.js";

const EXERCISES_JSON_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

let cachedCatalog: ExerciseDbEntry[] | undefined;

/**
 * Fetches the full free-exercise-db catalog (~800+ entries) as a single JSON
 * array. Cached in memory for the lifetime of the process so a single script
 * run only fetches it once.
 */
export async function fetchFullCatalog(): Promise<ExerciseDbEntry[]> {
  if (cachedCatalog) return cachedCatalog;

  const response = await fetch(EXERCISES_JSON_URL);
  if (!response.ok) {
    throw new Error(`free-exercise-db fetch failed (${response.status}): ${await response.text()}`);
  }
  const body = (await response.json()) as ExerciseDbEntry[];
  cachedCatalog = body;
  return body;
}

/**
 * Builds the full raw.githubusercontent.com image URL for a catalog entry's
 * first image (e.g. "3_4_Sit-Up/0.jpg" -> the full URL), or undefined when
 * the entry has no images.
 */
export function resolveImageUrl(entry: ExerciseDbEntry): string | undefined {
  const relativePath = entry.images[0];
  if (!relativePath) return undefined;
  return `${IMAGE_BASE_URL}${relativePath}`;
}
