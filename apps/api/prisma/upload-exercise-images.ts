/**
 * Hosts the exercise images on our own Cloudinary account.
 * Reads seed-data/simplyfitness.json, uploads each image to gytracker/exercises/<slug>,
 * then rewrites imageUrl to the Cloudinary URL (original kept in sourceImageUrl).
 * Idempotent: existing assets are reused, and the JSON is only written once every
 * exercise succeeded. Run after prisma:scrape-exercises and before prisma:seed.
 * Run: pnpm --filter @routine-tracker/api prisma:upload-exercise-images [--force]
 */
import "dotenv/config";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  configureCloudinary,
  findExerciseImage,
  httpCode,
  missingCloudinaryVars,
  uploadExerciseImage,
} from "./cloudinary-client.js";

const DATA_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "seed-data", "simplyfitness.json");
const DELAY_MS = 300;
// --force: skip the existence lookup and overwrite existing assets (invalidating the CDN cache).
const FORCE = process.argv.includes("--force");

interface Entry {
  slug: string;
  imageUrl: string;
  sourceImageUrl?: string;
  [key: string]: unknown;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errorClass = (err: unknown) => {
  const e = err as { name?: string; message?: string; error?: { message?: string } };
  const code = httpCode(err);
  return `${code ? `HTTP ${code}: ` : ""}${e?.error?.message ?? e?.message ?? e?.name ?? "Error"}`;
};

async function main() {
  const missing = missingCloudinaryVars();
  if (missing.length > 0) {
    console.error(`Missing Cloudinary environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
  configureCloudinary();

  const data = JSON.parse(await readFile(DATA_PATH, "utf8")) as { exercises: Entry[] };
  const result = new Map<string, { url: string; source: string }>();
  let uploaded = 0;
  let reused = 0;
  const failed: string[] = [];

  for (const ex of data.exercises) {
    const source = ex.sourceImageUrl ?? ex.imageUrl;
    try {
      let url = FORCE ? null : await findExerciseImage(ex.slug);
      if (url) {
        reused++;
      } else {
        try {
          url = await uploadExerciseImage(source, ex.slug, FORCE);
        } catch {
          await sleep(1500);
          url = await uploadExerciseImage(source, ex.slug, FORCE);
        }
        uploaded++;
        await sleep(DELAY_MS);
      }
      result.set(ex.slug, { url, source });
    } catch (err) {
      failed.push(`${ex.slug} (${errorClass(err)})`);
    }
  }

  console.log(`Uploaded: ${uploaded}, reused: ${reused}, failed: ${failed.length}`);
  if (failed.length > 0) {
    console.error(`Failed:\n  ${failed.join("\n  ")}\nJSON not modified; rerun to resume.`);
    process.exit(1);
  }

  for (const ex of data.exercises) {
    const r = result.get(ex.slug)!;
    ex.sourceImageUrl ??= r.source;
    ex.imageUrl = r.url;
  }
  const bad = data.exercises.filter((e) => !e.imageUrl.includes("res.cloudinary.com"));
  if (bad.length > 0) {
    console.error(`Validation failed, non-Cloudinary URLs: ${bad.map((e) => e.slug).join(", ")}`);
    process.exit(1);
  }

  const tmp = `${DATA_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2) + "\n");
  await rename(tmp, DATA_PATH);
  console.log(`Validated ${data.exercises.length}/${data.exercises.length} Cloudinary URLs; JSON updated.`);
}

main().catch((err) => {
  console.error(`Upload script failed: ${errorClass(err)}`);
  process.exit(1);
});
