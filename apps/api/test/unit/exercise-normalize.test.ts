import { describe, expect, it } from "vitest";
import {
  cleanMuscleNames,
  deriveEquipmentType,
  deriveMovementType,
  deriveMuscleGroup,
  normalizeEquipment,
  normalizeExercise,
  type RawExercise,
} from "../../prisma/exercise-normalize.js";

describe("cleanMuscleNames", () => {
  it("strips parentheticals and collapses deltoid variants", () => {
    expect(cleanMuscleNames(["deltoides (principalmente el haz medio)"])).toEqual(["Deltoides"]);
    expect(cleanMuscleNames(["deltoides anteriores", "deltoides posterior", "hombros"])).toEqual(["Deltoides"]);
    expect(cleanMuscleNames(["pectorales (trabaja principalmente el haz clavicular de los pectorales)"])).toEqual([
      "Pectorales",
    ]);
  });

  it("splits 'X y Y' compounds and drops articles/prefixes", () => {
    expect(cleanMuscleNames(["músculos de los muslos y los glúteos"])).toEqual(["Cuádriceps", "Glúteos"]);
    expect(cleanMuscleNames(["abdominales y lumbares"])).toEqual(["Abdominales", "Espalda baja"]);
    expect(cleanMuscleNames(["músculos centrales (core) y gemelos"])).toEqual(["Abdominales", "Gemelos"]);
  });

  it("drops sentence garbage", () => {
    expect(cleanMuscleNames(["este ejercicio no es un movimiento de fortalecimiento"])).toEqual([]);
    expect(cleanMuscleNames(["sino que se puede utilizar para estirar y calentar al comienzo"])).toEqual([]);
  });

  it("salvages the muscle list after a colon in stretch sentences", () => {
    expect(
      cleanMuscleNames([
        "sino que se puede utilizar para estirar y calentar. estos son los principales músculos que estirará: músculos de la cadera",
      ]),
    ).toEqual(["Cadera"]);
  });

  it("keeps medium-length real muscle lists", () => {
    expect(cleanMuscleNames(["músculos de los glúteos y músculos centrales (core)"])).toEqual(["Glúteos", "Abdominales"]);
  });

  it("dedupes across entries", () => {
    expect(cleanMuscleNames(["isquios", "isquiotibiales y los glúteos"])).toEqual(["Isquiotibiales", "Glúteos"]);
  });
});

describe("normalizeEquipment", () => {
  it("merges near-duplicates", () => {
    expect(normalizeEquipment(["mancuerna", "mancuernas"])).toEqual(["Mancuernas"]);
    expect(normalizeEquipment(["minibanda", "mini banda"])).toEqual(["Minibanda"]);
    expect(normalizeEquipment(["alfombra de yoga", "alfombra para yoga"])).toEqual(["Colchoneta"]);
    expect(normalizeEquipment(["barra de tracción"])).toEqual(["Barra de dominadas"]);
  });

  it("splits compounds and strips counters", () => {
    expect(normalizeEquipment(["barra y banco"])).toEqual(["Barra", "Banco"]);
    expect(normalizeEquipment(["barra recta o barra ez"])).toEqual(["Barra recta", "Barra Z"]);
    expect(normalizeEquipment(["dos bancos"])).toEqual(["Banco"]);
    expect(normalizeEquipment(["dos asas de agarre y dos cables de polea alta"])).toEqual([
      "Asa de agarre",
      "Cable de polea alta",
    ]);
    expect(normalizeEquipment(["máquina y banco smith"])).toEqual(["Máquina Smith", "Banco"]);
  });

  it("shortens long padding sentences", () => {
    expect(
      normalizeEquipment(["almohadilla tubular para sentadillas o toalla si es necesario para el acolchado"]),
    ).toEqual(["Almohadilla para sentadillas"]);
  });

  it("returns empty for bodyweight", () => {
    expect(normalizeEquipment([])).toEqual([]);
  });
});

describe("deriveEquipmentType", () => {
  it("falls back to bodyweight when no equipment", () => {
    expect(deriveEquipmentType([])).toBe("Peso corporal");
  });

  it("picks the most specific piece, not the bench", () => {
    expect(deriveEquipmentType(["Barra", "Banco"])).toBe("Barra");
    expect(deriveEquipmentType(["Banco", "Mancuernas"])).toBe("Mancuerna");
    expect(deriveEquipmentType(["Barra Z"])).toBe("Barra Z");
    expect(deriveEquipmentType(["Barra de dominadas"])).toBe("Barra de dominadas");
    expect(deriveEquipmentType(["Cable de polea baja", "Asa de agarre"])).toBe("Máquina de poleas");
    expect(deriveEquipmentType(["Máquina de prensa de piernas"])).toBe("Máquina");
    expect(deriveEquipmentType(["Colchoneta"])).toBe("Colchoneta");
    expect(deriveEquipmentType(["Pared"])).toBe("Peso corporal");
  });
});

describe("deriveMuscleGroup", () => {
  it("maps categories to legacy labels", () => {
    expect(deriveMuscleGroup("x", ["triceps"])).toBe("Brazos");
    expect(deriveMuscleGroup("x", ["calves"])).toBe("Pantorrillas");
    expect(deriveMuscleGroup("x", ["legs"])).toBe("Piernas");
  });

  it("overrides bird-dog to abdominals", () => {
    expect(deriveMuscleGroup("bird-dog", ["legs"])).toBe("Abdominales");
  });

  it("throws on unknown category", () => {
    expect(() => deriveMuscleGroup("x", ["nope"])).toThrow();
  });
});

describe("deriveMovementType", () => {
  it("is compound with secondary or multiple primary muscles", () => {
    expect(deriveMovementType(["Pectorales"], ["Tríceps"])).toBe("COMPOUND");
    expect(deriveMovementType(["Cuádriceps", "Glúteos"], [])).toBe("COMPOUND");
  });

  it("is isolation for a single muscle", () => {
    expect(deriveMovementType(["Bíceps"], [])).toBe("ISOLATION");
  });

  it("forces isolation for hand-reviewed slugs despite secondary muscles", () => {
    expect(deriveMovementType(["Pectorales"], ["Deltoides"], "dumbbell-fly")).toBe("ISOLATION");
    expect(deriveMovementType(["Cuádriceps", "Glúteos"], ["Abdominales"], "wall-sit")).toBe("ISOLATION");
    expect(deriveMovementType(["Pectorales"], ["Deltoides"], "bench-press")).toBe("COMPOUND");
  });
});

describe("normalizeExercise overrides", () => {
  const base: RawExercise = {
    slug: "x",
    name: "X",
    categories: ["chest"],
    startPosition: "s",
    execution: "e",
    equipment: [],
    primaryMuscles: ["pectorales"],
    secondaryMuscles: [],
    imageUrl: "https://example.com/x.png",
    sourceUrl: "https://example.com/x",
  };

  it("fixes barbell-push-press equipment", () => {
    const result = normalizeExercise({ ...base, slug: "barbell-push-press", equipment: ["mancuernas"] });
    expect(result.equipment).toEqual(["Barra"]);
    expect(result.equipmentType).toBe("Barra");
  });

  it("forces the pulley type for triceps-pressdown", () => {
    const result = normalizeExercise({ ...base, slug: "triceps-pressdown", equipment: ["barra ez", "banco"] });
    expect(result.equipmentType).toBe("Máquina de poleas");
  });

  it("drops the garbage Pectorales primary muscle of squat-sit-to-reach", () => {
    const result = normalizeExercise({
      ...base,
      slug: "squat-sit-to-reach",
      primaryMuscles: ["músculos de los muslos y pectorales"],
    });
    expect(result.primaryMuscles).toEqual(["Cuádriceps"]);
  });

  it("merges Core into Abdominales and muslos into Cuádriceps", () => {
    const result = normalizeExercise({
      ...base,
      primaryMuscles: ["músculos de los muslos"],
      secondaryMuscles: ["músculos centrales (core)", "abdominales"],
    });
    expect(result.primaryMuscles).toEqual(["Cuádriceps"]);
    expect(result.secondaryMuscles).toEqual(["Abdominales"]);
  });
});
