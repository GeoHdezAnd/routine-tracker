// Pure matching/mapping helpers for the free-exercise-db backfill (prisma/backfill-exercise-images.ts).
// Kept side-effect-free and separate from the script so it can be unit-tested without network/DB access.

export type MovementType = "COMPOUND" | "ISOLATION";

export type ExerciseDbEntry = {
  id: string;
  name: string;
  force?: string | null;
  level?: string;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string;
  images: string[];
};

/**
 * Normalizes an exercise name for cross-catalog comparison: lowercases,
 * strips diacritics, drops punctuation, and collapses whitespace.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// free-exercise-db's primaryMuscles/secondaryMuscles vocabulary (confirmed by
// scanning the full dataset — https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json,
// 876 entries, 17 distinct muscle values) mapped onto the same Spanish muscle
// group categories already used in prisma/seed-data/wger-exercises.json.
// Every value in the dataset maps cleanly here; the capitalized-slug/"Otro"
// fallback below only applies to values outside this known vocabulary.
const MUSCLE_SLUG_TO_GROUP: Record<string, string> = {
  abdominals: "Abdominales",
  biceps: "Brazos",
  triceps: "Brazos",
  forearms: "Brazos",
  calves: "Pantorrillas",
  chest: "Pecho",
  shoulders: "Hombros",
  neck: "Hombros",
  traps: "Espalda",
  lats: "Espalda",
  "middle back": "Espalda",
  "lower back": "Espalda",
  glutes: "Piernas",
  hamstrings: "Piernas",
  quadriceps: "Piernas",
  adductors: "Piernas",
  abductors: "Piernas",
};

export function mapMuscleGroup(primaryMuscles: string[]): string {
  for (const slug of primaryMuscles) {
    const mapped = MUSCLE_SLUG_TO_GROUP[slug];
    if (mapped) return mapped;
  }
  const [first] = primaryMuscles;
  if (!first) return "Otro";
  return first
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// free-exercise-db equipment values (confirmed by scanning the full dataset:
// "None", bands, barbell, body only, cable, dumbbell, e-z curl bar, exercise
// ball, foam roll, kettlebells, machine, medicine ball, other) mapped onto
// the same Spanish equipment labels already used in the curated seed data.
const EQUIPMENT_TO_SPANISH: Record<string, string> = {
  barbell: "Barra",
  dumbbell: "Mancuerna",
  machine: "Máquina",
  cable: "Máquina de poleas",
  "body only": "Peso corporal",
  bands: "Bandas",
  kettlebells: "Kettlebell",
  "medicine ball": "Balón medicinal",
  "exercise ball": "Pelota de ejercicio",
  "foam roll": "Rodillo de espuma",
  "e-z curl bar": "Barra Z",
  other: "Otro",
};

export function mapEquipmentType(equipment: string | null | undefined): string {
  if (!equipment) return "Peso corporal";
  return EQUIPMENT_TO_SPANISH[equipment] ?? equipment;
}

const ISOLATION_KEYWORDS = [
  "curl",
  "extension",
  "raise",
  "fly",
  "flye",
  "kickback",
  "shrug",
  "adduction",
  "abduction",
  "crossover",
];

const COMPOUND_KEYWORDS = [
  "squat",
  "deadlift",
  "press",
  "row",
  "pull-up",
  "pullup",
  "chin-up",
  "dip",
  "clean",
  "snatch",
  "thruster",
  "lunge",
  "step-up",
  "good morning",
  "hip thrust",
  "pulldown",
  "pullover",
];

/**
 * Resolves a catalog entry's movementType. free-exercise-db's own `mechanic`
 * field (compound/isolation) is trusted first — it's populated for most
 * entries and more reliable than a keyword guess; when missing/unrecognized,
 * falls back to a keyword heuristic on the exercise name, defaulting to
 * COMPOUND when ambiguous — this heuristic branch is a rough approximation,
 * nothing more.
 */
export function resolveMovementType(entry: { name: string; mechanic?: string | null }): MovementType {
  const raw = entry.mechanic?.toLowerCase();
  if (raw === "compound") return "COMPOUND";
  if (raw === "isolation") return "ISOLATION";

  const normalized = normalizeName(entry.name);
  if (ISOLATION_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "ISOLATION";
  if (COMPOUND_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "COMPOUND";
  return "COMPOUND";
}

/**
 * Finds the free-exercise-db catalog entry matching a DB exercise name. Tries
 * a direct normalized-name match first (works for English-named exercises),
 * then falls back to translating via the curated seed data's Spanish name ->
 * English name (_source.nameEn) map, since most of our global exercises are
 * Spanish while the free-exercise-db catalog is English-only.
 */
export function findCatalogMatch(
  dbExerciseName: string,
  catalog: ExerciseDbEntry[],
  nameEnBySpanishName?: Map<string, string>,
): ExerciseDbEntry | undefined {
  const normalizedDbName = normalizeName(dbExerciseName);

  const direct = catalog.find((entry) => normalizeName(entry.name) === normalizedDbName);
  if (direct) return direct;

  const nameEn = nameEnBySpanishName?.get(normalizedDbName);
  if (!nameEn) return undefined;

  const normalizedNameEn = normalizeName(nameEn);
  return catalog.find((entry) => normalizeName(entry.name) === normalizedNameEn);
}
