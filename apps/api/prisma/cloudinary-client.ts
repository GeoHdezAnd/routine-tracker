// Thin Cloudinary wrapper for the exercise-image backfill script. Kept separate
// from backfill-exercise-images.ts so the "are credentials configured" check can
// run (and fail gracefully) before anything else in the script does real work.
import { v2 as cloudinary } from "cloudinary";

export function assertCloudinaryConfigured(): void {
  const missing = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].filter(
    (key) => !process.env[key],
  );
  if (missing.length > 0) {
    console.error(
      `Missing Cloudinary credentials: ${missing.join(", ")}.\n` +
        "Create a Cloudinary account and set these in apps/api/.env before running this script.",
    );
    process.exit(1);
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Uploads an exercise image to Cloudinary under the `gytracker/exercises`
 * folder and returns its secure_url. `sourceUrl` is passed straight to
 * Cloudinary's upload API, which fetches it server-side — no need to
 * download the bytes ourselves in Node.
 */
export async function uploadExerciseImage(sourceUrl: string, publicId: string): Promise<string> {
  const result = await cloudinary.uploader.upload(sourceUrl, {
    folder: "gymtracker/exercises",
    public_id: publicId,
    resource_type: "image",
    overwrite: true,
  });
  return result.secure_url;
}
