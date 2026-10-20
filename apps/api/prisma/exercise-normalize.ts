// Pure helpers that turn the free-form Spanish strings scraped from
// simplyfitness.com into the normalized values the app filters on.

export type MovementType = "COMPOUND" | "ISOLATION";

export interface RawExercise {
  slug: string;
  name: string;
  categories: string[];
  startPosition: string;
  execution: string;
  equipment: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  imageUrl: string;
  sourceUrl: string;
}

export interface NormalizedExercise {
  slug: string;
  name: string;
  muscleGroup: string;
  equipmentType: string;
  movementType: MovementType;
  imageUrl: string;
  startPosition: string;
  execution: string;
  equipment: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

const BODYWEIGHT = "Peso corporal";

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------- muscles

const MUSCLE_ALIASES: Record<string, string> = {
  deltoides: "Deltoides",
  "deltoides anterior": "Deltoides",
  "deltoides anteriores": "Deltoides",
  "deltoides posterior": "Deltoides",
  "deltoides posteriores": "Deltoides",
  "deltoides frontales": "Deltoides",
  hombros: "Deltoides",
  pectoral: "Pectorales",
  pectorales: "Pectorales",
  "pectoral inferior": "Pectorales",
  "pectorales inferiores": "Pectorales",
  isquios: "Isquiotibiales",
  isquiotibiales: "Isquiotibiales",
  "abductores de cadera": "Abductores",
  lumbares: "Espalda baja",
  "espalda baja": "Espalda baja",
  "superiores de la espalda": "Espalda alta",
  centrales: "Abdominales",
  core: "Abdominales",
  abdominales: "Abdominales",
  muslos: "Cuádriceps",
};

function isGarbage(value: string): boolean {
  return value.length > 60 || value.includes("sino que") || value.includes("no es un movimiento");
}

function canonicalMuscle(value: string): string | null {
  const stripped = value
    .replace(/^músculos\s+(?:de(?:l|\s+los|\s+las|\s+la)?\s+)?/, "")
    .replace(/^(?:los|las|la|el)\s+/, "")
    .trim();
  if (!stripped) return null;
  return MUSCLE_ALIASES[stripped] ?? capitalize(stripped);
}

// Normalizes a list of raw muscle strings into deduplicated display names.
export function cleanMuscleNames(raw: string[]): string[] {
  const result: string[] = [];
  for (const entry of raw) {
    let text = entry
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Stretch pages put the real muscles after "...que estirará: <muscles>".
    if (isGarbage(text) && text.includes(":")) {
      text = text.slice(text.lastIndexOf(":") + 1).trim();
    }
    if (!text || isGarbage(text)) continue;

    for (const part of text.split(/\s+y\s+/)) {
      const muscle = canonicalMuscle(part.trim());
      if (muscle && !result.includes(muscle)) result.push(muscle);
    }
  }
  return result;
}

// -------------------------------------------------------------- equipment

const EQUIPMENT_ALIASES: Record<string, string[]> = {
  "máquina y banco smith": ["Máquina Smith", "Banco"],
  "máquina de cable y accesorios de tobillo": ["Máquina de poleas", "Accesorios de tobillo"],
  "máquina de cable con accesorios para el tobillo": ["Máquina de poleas", "Accesorios de tobillo"],
  "almohadilla tubular para sentadillas o toalla si es necesario para el acolchado": ["Almohadilla para sentadillas"],
  "almohadilla para sentadillas o toalla si es necesario para el acolchado": ["Almohadilla para sentadillas"],
};

const EQUIPMENT_RULES: Array<[RegExp, string]> = [
  [/^mini\s?banda$/, "Minibanda"],
  [/^alfombra (?:de|para) yoga$/, "Colchoneta"],
  [/^mancuernas?$/, "Mancuernas"],
  [/^barra (?:ez|z)$/, "Barra Z"],
  [/^barra de tracción$/, "Barra de dominadas"],
  [/^barras? paralelas$/, "Barras paralelas"],
  [/^bancos?$/, "Banco"],
  [/^discos?$/, "Discos"],
  [/^máquina sentado$/, "Máquina"],
  [/^máquina smith$/, "Máquina Smith"],
  [/^máquina ghd$/, "Máquina GHD"],
  [/^cables? de polea (alta|baja)$/, "Cable de polea $1"],
  [/^polea (alta|baja)$/, "Cable de polea $1"],
  [/^asas? de agarre$/, "Asa de agarre"],
  [/^pared(?: plana)?$/, "Pared"],
];

function canonicalEquipment(part: string): string {
  const text = part.replace(/^(?:un|una|unos|unas|dos)\s+/, "").trim();
  for (const [pattern, label] of EQUIPMENT_RULES) {
    if (pattern.test(text)) return text.replace(pattern, label);
  }
  return capitalize(text);
}

// Normalizes raw equipment strings: merges near-duplicates (singular/plural,
// spelling variants) and splits compounds ("barra y banco", "A o B").
export function normalizeEquipment(raw: string[]): string[] {
  const result: string[] = [];
  for (const entry of raw) {
    const text = entry.toLowerCase().replace(/\s+/g, " ").trim();
    if (!text) continue;
    const labels = EQUIPMENT_ALIASES[text] ?? text.split(/\s+[yo]\s+/).map(canonicalEquipment);
    for (const label of labels) {
      if (!result.includes(label)) result.push(label);
    }
  }
  return result;
}

// Single filterable equipment type, most specific/limiting piece first.
// Values stay compatible with the legacy catalog ("Mancuerna", "Barra Z", ...).
const EQUIPMENT_TYPE_PRIORITY = [
  "Máquina de poleas",
  "Máquina",
  "Barra Z",
  "Barra",
  "Barra de dominadas",
  "Barras paralelas",
  "Mancuerna",
  "Kettlebell",
  "Balón medicinal",
  "Discos",
  "Minibanda",
  "Banco",
  "Step",
  "Colchoneta",
  BODYWEIGHT,
] as const;

function equipmentTypeOf(item: string): string {
  const text = item.toLowerCase();
  if (/^(?:cable|cuerda|asa|accesorios|máquina de poleas|máquina de cable)/.test(text)) return "Máquina de poleas";
  if (text.startsWith("máquina")) return "Máquina";
  if (text === "barra z") return "Barra Z";
  if (text === "barra de dominadas") return "Barra de dominadas";
  if (text === "barras paralelas") return "Barras paralelas";
  if (text.startsWith("barra")) return "Barra";
  if (text === "mancuernas") return "Mancuerna";
  if (text.startsWith("banco")) return "Banco";
  const match = EQUIPMENT_TYPE_PRIORITY.find((type) => type.toLowerCase() === text);
  return match ?? BODYWEIGHT;
}

export function deriveEquipmentType(equipment: string[]): string {
  if (equipment.length === 0) return BODYWEIGHT;
  const types = equipment.map(equipmentTypeOf);
  return EQUIPMENT_TYPE_PRIORITY.find((type) => types.includes(type)) ?? BODYWEIGHT;
}

// ----------------------------------------------------------------- groups

// Same seven labels the legacy catalog used, so web filters/colours keep working.
const CATEGORY_TO_MUSCLE_GROUP: Record<string, string> = {
  abdominals: "Abdominales",
  back: "Espalda",
  biceps: "Brazos",
  triceps: "Brazos",
  calves: "Pantorrillas",
  chest: "Pecho",
  legs: "Piernas",
  shoulders: "Hombros",
};

// Source miscategorizations, keyed by slug.
const MUSCLE_GROUP_OVERRIDES: Record<string, string> = {
  "bird-dog": "Abdominales",
};

export function deriveMuscleGroup(slug: string, categories: string[]): string {
  const override = MUSCLE_GROUP_OVERRIDES[slug];
  if (override) return override;
  const group = categories.map((category) => CATEGORY_TO_MUSCLE_GROUP[category]).find(Boolean);
  if (!group) throw new Error(`Unknown category for "${slug}": ${categories.join(", ")}`);
  return group;
}

// Exercises the heuristic below gets wrong, keyed by slug (reviewed by hand).
const MOVEMENT_TYPE_OVERRIDES: Record<string, MovementType> = Object.fromEntries(
  [
    "peck-deck",
    "cable-crossover",
    "dumbbell-fly",
    "incline-dumbbell-fly",
    "lying-leg-curl",
    "seated-leg-curl",
    "dumbbell-lateral-raise",
    "bent-over-lateral-raise",
    "high-cable-rear-delt-fly",
    "straight-arm-lat-pulldown",
    "reverse-barbell-curl",
    "seated-hip-abduction-machine",
    "standing-cable-abduction",
    "standing-cable-kickback",
    "banded-clams",
    "donkey-kicks",
    "fire-hydrants",
    "side-lying-leg-raise",
    "wall-sit",
  ].map((slug) => [slug, "ISOLATION" as const]),
);

// Source data fixes, keyed by slug.
const EQUIPMENT_OVERRIDES: Record<string, { equipment?: string[]; equipmentType: string }> = {
  "barbell-push-press": { equipment: ["Barra"], equipmentType: "Barra" },
  "triceps-pressdown": { equipmentType: "Máquina de poleas" },
};

// Muscles scraped wrongly for a given exercise (normalized names).
const PRIMARY_MUSCLE_DROPS: Record<string, string[]> = {
  "squat-sit-to-reach": ["Pectorales"],
};

// COMPOUND when more than one muscle is involved (secondary muscles present or
// several primary muscles), ISOLATION otherwise. A heuristic, not ground truth;
// MOVEMENT_TYPE_OVERRIDES wins when the slug is listed.
export function deriveMovementType(
  primaryMuscles: string[],
  secondaryMuscles: string[],
  slug?: string,
): MovementType {
  const override = slug ? MOVEMENT_TYPE_OVERRIDES[slug] : undefined;
  if (override) return override;
  return secondaryMuscles.length > 0 || primaryMuscles.length > 1 ? "COMPOUND" : "ISOLATION";
}

export function normalizeExercise(raw: RawExercise): NormalizedExercise {
  const equipmentOverride = EQUIPMENT_OVERRIDES[raw.slug];
  const equipment = equipmentOverride?.equipment ?? normalizeEquipment(raw.equipment);
  const dropped = PRIMARY_MUSCLE_DROPS[raw.slug] ?? [];
  const primaryMuscles = cleanMuscleNames(raw.primaryMuscles).filter((muscle) => !dropped.includes(muscle));
  const secondaryMuscles = cleanMuscleNames(raw.secondaryMuscles).filter((muscle) => !primaryMuscles.includes(muscle));

  return {
    slug: raw.slug,
    name: raw.name,
    muscleGroup: deriveMuscleGroup(raw.slug, raw.categories),
    equipmentType: equipmentOverride?.equipmentType ?? deriveEquipmentType(equipment),
    movementType: deriveMovementType(primaryMuscles, secondaryMuscles, raw.slug),
    imageUrl: raw.imageUrl,
    startPosition: raw.startPosition,
    execution: raw.execution,
    equipment,
    primaryMuscles,
    secondaryMuscles,
  };
}
