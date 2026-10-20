// Thin Cloudinary wrapper for the exercise-image upload script. Kept separate so
// the "are credentials configured" check can run before any real work happens.
import { v2 as cloudinary } from "cloudinary";

const REQUIRED_VARS = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const;

export const EXERCISES_FOLDER = "gytracker/exercises";

/** Returns the names (never the values) of the missing credential variables. */
export function missingCloudinaryVars(): string[] {
  return REQUIRED_VARS.filter((key) => !process.env[key]);
}

export function configureCloudinary(): void {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/** Cloudinary rejects with either `{ http_code }` or `{ error: { http_code } }`. */
export function httpCode(err: unknown): number | undefined {
  const e = err as { http_code?: number; error?: { http_code?: number } };
  return e?.http_code ?? e?.error?.http_code;
}

/** Returns the secure_url of an already-uploaded exercise image, or null if absent. */
export async function findExerciseImage(slug: string): Promise<string | null> {
  try {
    const res = await cloudinary.api.resource(`${EXERCISES_FOLDER}/${slug}`, { resource_type: "image" });
    return res.secure_url as string;
  } catch (err) {
    if (httpCode(err) === 404) return null;
    throw err;
  }
}

/**
 * Uploads `sourceUrl` (fetched server-side by Cloudinary) as
 * `gytracker/exercises/<slug>` without overwriting an existing asset.
 */
export async function uploadExerciseImage(sourceUrl: string, slug: string, force = false): Promise<string> {
  const res = await cloudinary.uploader.upload(sourceUrl, {
    folder: EXERCISES_FOLDER,
    public_id: slug,
    resource_type: "image",
    overwrite: force,
    invalidate: force,
  });
  return res.secure_url;
}
