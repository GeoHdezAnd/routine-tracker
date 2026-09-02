import { describe, expect, it } from "vitest";
import {
  findCatalogMatch,
  mapEquipmentType,
  mapMuscleGroup,
  normalizeName,
  resolveMovementType,
  type ExerciseDbEntry,
} from "../../prisma/exercise-db-mapping.js";

function catalogEntry(overrides: Partial<ExerciseDbEntry> & { name: string }): ExerciseDbEntry {
  return {
    id: overrides.name.replace(/\s+/g, "_"),
    equipment: "barbell",
    primaryMuscles: ["chest"],
    images: [`${overrides.name.replace(/\s+/g, "_")}/0.jpg`],
    ...overrides,
  };
}

describe("normalizeName", () => {
  it("lowercases, strips accents, and collapses whitespace", () => {
    expect(normalizeName("Sentadilla Búlgara  con Mancuernas")).toBe("sentadilla bulgara con mancuernas");
  });

  it("strips punctuation", () => {
    expect(normalizeName("Barbell Bench Press - Medium Grip")).toBe("barbell bench press medium grip");
  });
});

describe("mapMuscleGroup", () => {
  it("maps a known free-exercise-db muscle slug to the Spanish group", () => {
    expect(mapMuscleGroup(["chest"])).toBe("Pecho");
    expect(mapMuscleGroup(["quadriceps"])).toBe("Piernas");
    expect(mapMuscleGroup(["biceps", "chest"])).toBe("Brazos");
  });

  it("maps multi-word muscle slugs to the Spanish group", () => {
    expect(mapMuscleGroup(["lower back"])).toBe("Espalda");
    expect(mapMuscleGroup(["middle back"])).toBe("Espalda");
  });

  it("falls back to a capitalized slug for unmapped muscles", () => {
    expect(mapMuscleGroup(["ankles"])).toBe("Ankles");
  });

  it("falls back to Otro when there are no primary muscles", () => {
    expect(mapMuscleGroup([])).toBe("Otro");
  });
});

describe("mapEquipmentType", () => {
  it("maps known free-exercise-db equipment values to Spanish labels", () => {
    expect(mapEquipmentType("barbell")).toBe("Barra");
    expect(mapEquipmentType("body only")).toBe("Peso corporal");
  });

  it("passes through unknown equipment values unchanged", () => {
    expect(mapEquipmentType("trap bar")).toBe("trap bar");
  });

  it("defaults to Peso corporal when the catalog entry has no equipment (bodyweight/plyometric drills)", () => {
    expect(mapEquipmentType(undefined)).toBe("Peso corporal");
    expect(mapEquipmentType(null)).toBe("Peso corporal");
    expect(mapEquipmentType("")).toBe("Peso corporal");
  });
});

describe("resolveMovementType", () => {
  it("trusts the catalog's own mechanic field when present", () => {
    expect(resolveMovementType({ name: "Whatever", mechanic: "isolation" })).toBe("ISOLATION");
    expect(resolveMovementType({ name: "Whatever", mechanic: "compound" })).toBe("COMPOUND");
  });

  it("falls back to a keyword heuristic when mechanic is missing", () => {
    expect(resolveMovementType({ name: "Dumbbell Bicep Curl" })).toBe("ISOLATION");
    expect(resolveMovementType({ name: "Barbell Squat" })).toBe("COMPOUND");
  });

  it("falls back to a keyword heuristic when mechanic is null", () => {
    expect(resolveMovementType({ name: "Dumbbell Bicep Curl", mechanic: null })).toBe("ISOLATION");
  });

  it("defaults to COMPOUND when the name matches no heuristic keyword", () => {
    expect(resolveMovementType({ name: "Farmer's Carry" })).toBe("COMPOUND");
  });
});

describe("findCatalogMatch", () => {
  const catalog = [
    catalogEntry({ name: "Barbell Squat" }),
    catalogEntry({ name: "Bench Press" }),
  ];

  it("matches directly by normalized name", () => {
    expect(findCatalogMatch("Barbell Squat", catalog)?.name).toBe("Barbell Squat");
  });

  it("returns undefined with no direct match and no nameEn map", () => {
    expect(findCatalogMatch("Sentadillas", catalog)).toBeUndefined();
  });

  it("falls back to the Spanish->English seed translation map", () => {
    const nameEnBySpanishName = new Map([[normalizeName("Sentadillas"), "Barbell Squat"]]);
    expect(findCatalogMatch("Sentadillas", catalog, nameEnBySpanishName)?.name).toBe("Barbell Squat");
  });

  it("returns undefined when the translated name still has no catalog match", () => {
    const nameEnBySpanishName = new Map([[normalizeName("Sentadillas"), "Leg Press"]]);
    expect(findCatalogMatch("Sentadillas", catalog, nameEnBySpanishName)).toBeUndefined();
  });
});
