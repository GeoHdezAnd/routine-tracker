// One-off maintenance script: clears Exercise.imageUrl on every row where
// it's currently set. Needed when switching image sources (e.g. the Anatome
// -> free-exercise-db switch) after the previously-uploaded Cloudinary
// assets have been deleted — without this, prisma:backfill-images' own
// idempotency check would skip those rows since it only fills imageUrl when
// it's null.
//
//   pnpm --filter @routine-tracker/api prisma:reset-images
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const result = await prisma.exercise.updateMany({
      where: { imageUrl: { not: null } },
      data: { imageUrl: null },
    });
    console.log(`Reset imageUrl to null on ${result.count} exercise(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Reset failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
