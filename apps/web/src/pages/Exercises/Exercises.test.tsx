import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipmentType: string;
  movementType: "COMPOUND" | "ISOLATION";
  ownerId: string | null;
  personalRecord: { weightKg: number; reps: number } | null;
};

const ALL_EXERCISES: Exercise[] = [
  {
    id: "ex1",
    name: "Sentadilla",
    muscleGroup: "Pierna",
    equipmentType: "Barra",
    movementType: "COMPOUND",
    ownerId: null,
    personalRecord: { weightKg: 100, reps: 5 },
  },
  {
    id: "ex2",
    name: "Press banca",
    muscleGroup: "Pecho",
    equipmentType: "Barra",
    movementType: "COMPOUND",
    ownerId: null,
    personalRecord: null,
  },
];

const LEG_EXERCISES = ALL_EXERCISES.filter((exercise) => exercise.muscleGroup === "Pierna");

function stubMeAndExercises() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/auth/me")) {
        return new Response(
          JSON.stringify({
            id: "1",
            email: "a@b.com",
            name: "Geo",
            birthDate: null,
            age: null,
            unitPreference: "KG",
            createdAt: "2024-01-01",
          }),
          { status: 200 },
        );
      }
      if (url.includes("/exercises")) {
        const parsed = new URL(url);
        const muscleGroup = parsed.searchParams.get("muscleGroup");
        const data = muscleGroup === "Pierna" ? LEG_EXERCISES : ALL_EXERCISES;
        return new Response(JSON.stringify({ data, total: data.length, limit: 100, offset: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 });
    }),
  );
}

describe("ExercisesPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("routine-tracker:token", "fake-token");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renderiza el catálogo de ejercicios devuelto por la API", async () => {
    stubMeAndExercises();

    renderWithProviders(["/exercises"]);

    expect(await screen.findByText("Sentadilla")).toBeInTheDocument();
    expect(screen.getByText("Press banca")).toBeInTheDocument();
    expect(screen.getAllByText("Barra · Compuesto")).toHaveLength(2);
  });

  it("muestra el PR solo en los ejercicios con series registradas", async () => {
    stubMeAndExercises();

    renderWithProviders(["/exercises"]);

    expect(await screen.findByText("Sentadilla")).toBeInTheDocument();
    expect(screen.getByText("100kg PR")).toBeInTheDocument();
    expect(screen.getAllByText(/PR$/)).toHaveLength(1);
  });

  it("filtra la lista por grupo muscular", async () => {
    stubMeAndExercises();

    renderWithProviders(["/exercises"]);

    expect(await screen.findByText("Press banca")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Pierna"));

    expect(await screen.findByText("Sentadilla")).toBeInTheDocument();
    expect(screen.queryByText("Press banca")).not.toBeInTheDocument();
  });
});
