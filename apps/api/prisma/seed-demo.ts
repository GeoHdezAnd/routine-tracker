import "dotenv/config";

import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type TrainingGoal } from "@prisma/client";

// Dev-only demo data: one user with routines, ~8 weeks of sessions and
// progressive set logs so the dashboard, charts and PRs have something to show.
// Re-running wipes and recreates only the demo user's data.

const DEMO_EMAIL = "demo@routine-tracker.dev";
const DEMO_PASSWORD = "demo12345";
const SALT_ROUNDS = 10; // same as auth.service.ts
const WEEKS = 8;
const MIN_CATALOG_SIZE = 50;
const SAFE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "postgres"]);

// ------------------------------------------------------------------ safety

function assertSafeEnvironment(connectionString: string | undefined): string {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run: NODE_ENV is production.");
    process.exit(1);
  }
  if (!connectionString) {
    console.error("Refusing to run: DATABASE_URL is not set.");
    process.exit(1);
  }
  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    console.error("Refusing to run: DATABASE_URL is not a valid URL.");
    process.exit(1);
  }
  if (!SAFE_HOSTS.has(host)) {
    console.error(
      `Refusing to run: database host "${host}" is not local (allowed: ${[...SAFE_HOSTS].join(", ")}).`,
    );
    process.exit(1);
  }
  return connectionString;
}

// -------------------------------------------------------------- generator

// mulberry32: tiny seeded PRNG so every run produces identical data.
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

interface ExerciseSpec {
  // Catalog slug, or a key into CUSTOM_EXERCISES.
  ref: string;
  goal: TrainingGoal;
  sets: number;
  repMin: number;
  repMax: number;
  supersetSlot?: number;
  startKg: number;
  // Fractional weekly gain on top of startKg.
  weeklyGain: number;
  // Plate granularity used when rounding the working weight.
  step: number;
  // Hold the weight over the last two sessions at the rep ceiling, so the
  // "ready to progress" suggestion shows up.
  plateau?: boolean;
}

interface RoutineSpec {
  name: string;
  color: string;
  trainingDays: string[];
  // JS getUTCDay() values (0 = Sunday) matching trainingDays.
  weekday: number;
  muscleGroups: string[];
  startHour: number;
  exercises: ExerciseSpec[];
}

const CUSTOM_EXERCISES = {
  "custom-face-pull": {
    name: "Face pull con banda",
    muscleGroup: "Hombros",
    equipmentType: "Minibanda",
    movementType: "ISOLATION" as const,
  },
  "custom-meadows-row": {
    name: "Remo Meadows",
    muscleGroup: "Espalda",
    equipmentType: "Barra",
    movementType: "COMPOUND" as const,
  },
};

const ROUTINES: RoutineSpec[] = [
  {
    name: "Push",
    color: "blue",
    trainingDays: ["MON"],
    weekday: 1,
    muscleGroups: ["Pecho", "Hombros", "Brazos"],
    startHour: 18,
    exercises: [
      { ref: "barbell-bench-press", goal: "STRENGTH", sets: 4, repMin: 4, repMax: 6, startKg: 60, weeklyGain: 0.025, step: 2.5 },
      { ref: "incline-dumbbell-bench-press", goal: "HYPERTROPHY", sets: 3, repMin: 8, repMax: 12, startKg: 22, weeklyGain: 0.02, step: 1 },
      { ref: "dumbbell-shoulder-press", goal: "HYPERTROPHY", sets: 3, repMin: 8, repMax: 12, startKg: 18, weeklyGain: 0.02, step: 1 },
      { ref: "dumbbell-lateral-raise", goal: "ENDURANCE", sets: 3, repMin: 12, repMax: 15, supersetSlot: 1, startKg: 8, weeklyGain: 0, step: 1, plateau: true },
      { ref: "triceps-pressdown", goal: "ENDURANCE", sets: 3, repMin: 12, repMax: 15, supersetSlot: 1, startKg: 25, weeklyGain: 0.02, step: 2.5 },
    ],
  },
  {
    name: "Pull",
    color: "teal",
    trainingDays: ["TUE"],
    weekday: 2,
    muscleGroups: ["Espalda", "Brazos"],
    startHour: 18,
    exercises: [
      { ref: "barbell-row", goal: "STRENGTH", sets: 4, repMin: 5, repMax: 8, startKg: 55, weeklyGain: 0.025, step: 2.5 },
      { ref: "wide-grip-pulldown", goal: "HYPERTROPHY", sets: 3, repMin: 8, repMax: 12, startKg: 50, weeklyGain: 0.02, step: 2.5 },
      { ref: "seated-cable-row", goal: "HYPERTROPHY", sets: 3, repMin: 8, repMax: 12, startKg: 45, weeklyGain: 0.02, step: 2.5 },
      { ref: "custom-face-pull", goal: "ENDURANCE", sets: 3, repMin: 15, repMax: 20, startKg: 10, weeklyGain: 0.02, step: 1 },
      { ref: "barbell-curl", goal: "HYPERTROPHY", sets: 3, repMin: 8, repMax: 12, supersetSlot: 2, startKg: 30, weeklyGain: 0.02, step: 2.5 },
      { ref: "hammer-curl", goal: "HYPERTROPHY", sets: 3, repMin: 10, repMax: 12, supersetSlot: 2, startKg: 12, weeklyGain: 0.02, step: 1 },
    ],
  },
  {
    name: "Legs",
    color: "orange",
    trainingDays: ["THU"],
    weekday: 4,
    muscleGroups: ["Piernas", "Pantorrillas"],
    startHour: 17,
    exercises: [
      { ref: "squat", goal: "STRENGTH", sets: 4, repMin: 4, repMax: 6, startKg: 80, weeklyGain: 0.025, step: 2.5 },
      { ref: "barbell-stiff-leg-deadlift", goal: "HYPERTROPHY", sets: 3, repMin: 8, repMax: 10, startKg: 70, weeklyGain: 0.025, step: 2.5 },
      { ref: "leg-press", goal: "HYPERTROPHY", sets: 3, repMin: 10, repMax: 12, startKg: 140, weeklyGain: 0.03, step: 5 },
      { ref: "lying-leg-curl", goal: "HYPERTROPHY", sets: 3, repMin: 10, repMax: 12, startKg: 35, weeklyGain: 0.02, step: 2.5 },
      { ref: "standing-calf-raise", goal: "ENDURANCE", sets: 4, repMin: 12, repMax: 15, startKg: 60, weeklyGain: 0.02, step: 5 },
    ],
  },
  {
    name: "Upper",
    color: "purple",
    trainingDays: ["SAT"],
    weekday: 6,
    muscleGroups: ["Pecho", "Espalda", "Hombros"],
    startHour: 10,
    exercises: [
      { ref: "close-grip-bench-press", goal: "STRENGTH", sets: 3, repMin: 5, repMax: 8, startKg: 50, weeklyGain: 0.025, step: 2.5 },
      { ref: "pull-up", goal: "STRENGTH", sets: 3, repMin: 5, repMax: 8, startKg: 5, weeklyGain: 0.04, step: 2.5 },
      { ref: "custom-meadows-row", goal: "HYPERTROPHY", sets: 3, repMin: 8, repMax: 12, startKg: 30, weeklyGain: 0.02, step: 2.5 },
      { ref: "dumbbell-fly", goal: "HYPERTROPHY", sets: 3, repMin: 10, repMax: 15, startKg: 10, weeklyGain: 0.015, step: 1 },
    ],
  },
];

interface GeneratedSet {
  setNumber: number;
  weightKg: number;
  reps: number;
  rir: number;
}

// Working weight for the k-th session (0 = oldest) of `total`, with a little
// noise. Plateau exercises hold the last two sessions at the same weight.
function workingWeight(spec: ExerciseSpec, k: number, total: number, rng: () => number): number {
  const effectiveK = spec.plateau ? Math.min(k, total - 3) : k;
  const noise = (rng() - 0.5) * 0.02;
  const weight = roundTo(spec.startKg * (1 + spec.weeklyGain * effectiveK + noise), spec.step);
  return Math.max(weight, spec.step);
}

function generateSets(spec: ExerciseSpec, k: number, total: number, rng: () => number): GeneratedSet[] {
  const weight = workingWeight(spec, k, total, rng);
  const holdAtCeiling = spec.plateau && k >= total - 2;
  const sets: GeneratedSet[] = [];
  for (let i = 0; i < spec.sets; i++) {
    // Reps fatigue slightly across sets; plateau sessions hit the ceiling.
    const base = holdAtCeiling ? spec.repMax : spec.repMax - Math.floor(rng() * 3);
    const reps = Math.min(spec.repMax, Math.max(spec.repMin, base - Math.floor(i * rng() * 1.5)));
    const rir = holdAtCeiling ? 1 : Math.min(3, Math.max(0, 3 - Math.floor(i * 0.7 + rng() * 1.5)));
    sets.push({ setNumber: i + 1, weightKg: weight, reps, rir });
  }
  return sets;
}

// ------------------------------------------------------------------- main

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const connectionString = assertSafeEnvironment(process.env.DATABASE_URL);
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const slugs = [...new Set(ROUTINES.flatMap((r) => r.exercises.map((e) => e.ref)))].filter(
      (ref) => !ref.startsWith("custom-"),
    );
    const catalogSize = await prisma.exercise.count({ where: { ownerId: null, slug: { not: null } } });
    if (catalogSize < MIN_CATALOG_SIZE) {
      console.error(`Only ${catalogSize} global exercises found. Run "pnpm prisma:seed" first.`);
      process.exit(1);
    }
    const catalog = await prisma.exercise.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
    const missing = slugs.filter((slug) => !catalog.some((e) => e.slug === slug));
    if (missing.length > 0) {
      console.error(`Missing catalog exercises: ${missing.join(", ")}. Run "pnpm prisma:seed" first.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
    const rng = createRng(20260815);
    const now = new Date();
    const counts = { routines: 0, routineExercises: 0, sessions: 0, setLogs: 0, planPeriods: 0, customExercises: 0 };

    await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.upsert({
          where: { email: DEMO_EMAIL },
          create: {
            email: DEMO_EMAIL,
            passwordHash,
            name: "Demo User",
            birthDate: new Date("1994-03-12T00:00:00.000Z"),
            bodyWeightKg: 78,
          },
          update: {
            passwordHash,
            name: "Demo User",
            birthDate: new Date("1994-03-12T00:00:00.000Z"),
            bodyWeightKg: 78,
            unitPreference: "KG",
          },
        });

        // Wipe in FK order: SetLog -> Exercise is Restrict, so logs go first.
        await tx.setLog.deleteMany({ where: { session: { userId: user.id } } });
        await tx.workoutSession.deleteMany({ where: { userId: user.id } });
        await tx.routine.deleteMany({ where: { userId: user.id } }); // cascades routine exercises + plan periods
        await tx.exercise.deleteMany({ where: { ownerId: user.id } });

        const exerciseIds = new Map<string, string>(catalog.map((e) => [e.slug!, e.id]));
        for (const [key, data] of Object.entries(CUSTOM_EXERCISES)) {
          const created = await tx.exercise.create({ data: { ...data, ownerId: user.id } });
          exerciseIds.set(key, created.id);
          counts.customExercises++;
        }

        const planStart = new Date(now.getTime() - (WEEKS + 1) * 7 * 86_400_000);
        const sessionRows: { id: string; userId: string; routineId: string; startedAt: Date; finishedAt: Date | null }[] = [];
        const setLogRows: {
          sessionId: string;
          exerciseId: string;
          setNumber: number;
          weightKg: number;
          reps: number;
          rir: number;
          createdAt: Date;
        }[] = [];

        for (const spec of ROUTINES) {
          const routine = await tx.routine.create({
            data: {
              userId: user.id,
              name: spec.name,
              color: spec.color,
              muscleGroups: spec.muscleGroups,
              trainingDays: spec.trainingDays,
              createdAt: planStart,
              planPeriods: { create: { startedAt: planStart } },
              exercises: {
                create: spec.exercises.map((e, order) => ({
                  exerciseId: exerciseIds.get(e.ref)!,
                  order,
                  supersetSlot: e.supersetSlot ?? null,
                  goal: e.goal,
                  targetSets: e.sets,
                  targetRepMin: e.repMin,
                  targetRepMax: e.repMax,
                })),
              },
            },
          });
          counts.routines++;
          counts.planPeriods++;
          counts.routineExercises += spec.exercises.length;

          // Past occurrences of this routine's weekday, oldest first, none in the future.
          const dates: Date[] = [];
          for (let daysAgo = WEEKS * 7; daysAgo >= 1; daysAgo--) {
            const day = new Date(now);
            day.setUTCDate(day.getUTCDate() - daysAgo);
            if (day.getUTCDay() === spec.weekday) dates.push(day);
          }

          dates.forEach((day, k) => {
            const startedAt = new Date(day);
            startedAt.setUTCHours(spec.startHour, Math.floor(rng() * 40), 0, 0);
            const durationMin = 50 + Math.floor(rng() * 25);
            const finishedAt = new Date(startedAt.getTime() + durationMin * 60_000);
            const sessionId = `demo-${spec.name.toLowerCase()}-${String(k).padStart(2, "0")}`;
            sessionRows.push({ id: sessionId, userId: user.id, routineId: routine.id, startedAt, finishedAt });

            let cursor = startedAt.getTime() + 2 * 60_000;
            for (const exercise of spec.exercises) {
              for (const set of generateSets(exercise, k, dates.length, rng)) {
                setLogRows.push({
                  sessionId,
                  exerciseId: exerciseIds.get(exercise.ref)!,
                  ...set,
                  createdAt: new Date(cursor),
                });
                cursor += (120 + Math.floor(rng() * 60)) * 1000;
              }
            }
          });

          // Most recent Push session is left in progress, started shortly ago.
          if (spec.name === "Push") {
            const startedAt = new Date(now.getTime() - 25 * 60_000);
            const sessionId = "demo-push-live";
            sessionRows.push({ id: sessionId, userId: user.id, routineId: routine.id, startedAt, finishedAt: null });
            const first = spec.exercises[0]!;
            const prior = dates.length;
            for (const set of generateSets(first, prior, prior + 1, rng).slice(0, 2)) {
              setLogRows.push({
                sessionId,
                exerciseId: exerciseIds.get(first.ref)!,
                ...set,
                createdAt: new Date(startedAt.getTime() + set.setNumber * 150_000),
              });
            }
          }
        }

        // Sessions need ids that sort sensibly; fixed ids keep reruns identical.
        // Prefix with the user id so they cannot collide with another user's rows.
        const idFor = (id: string) => `${id}-${user.id.slice(-6)}`;
        await tx.workoutSession.createMany({
          data: sessionRows.map((s) => ({ ...s, id: idFor(s.id) })),
        });
        for (const batch of chunk(setLogRows, 500)) {
          await tx.setLog.createMany({ data: batch.map((l) => ({ ...l, sessionId: idFor(l.sessionId) })) });
        }
        counts.sessions = sessionRows.length;
        counts.setLogs = setLogRows.length;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    console.log("Demo data created:");
    console.table(counts);
    console.log(`Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Demo seed failed:", error);
  process.exit(1);
});
