import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

type RoutineExercise = {
  id: string;
  order: number;
  supersetSlot: number | null;
  goal: "STRENGTH" | "HYPERTROPHY" | "ENDURANCE";
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
  exercise: { id: string; name: string; muscleGroup: string; movementType: "COMPOUND" | "ISOLATION" };
};

type Routine = {
  id: string;
  name: string;
  muscleGroups: string[];
  trainingDays: string[];
  exercises: RoutineExercise[];
};

function baseRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: "r1",
    name: "Push Day",
    muscleGroups: [],
    trainingDays: [],
    exercises: [
      {
        id: "re1",
        order: 1,
        supersetSlot: null,
        goal: "HYPERTROPHY",
        targetSets: 3,
        targetRepMin: 8,
        targetRepMax: 12,
        exercise: { id: "ex1", name: "Press banca", muscleGroup: "Pecho", movementType: "COMPOUND" },
      },
    ],
    ...overrides,
  };
}

function stubApi(routine: Routine) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
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
      if (url.includes("/routines/rep-range-suggestion")) {
        return new Response(JSON.stringify({ targetRepMin: 5, targetRepMax: 8 }), { status: 200 });
      }
      if (url.endsWith(`/routines/${routine.id}`) && (!init?.method || init.method === "GET")) {
        return new Response(JSON.stringify(routine), { status: 200 });
      }
      if (url.endsWith("/sessions") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "sess1" }), { status: 201 });
      }
      if (url.endsWith("/sessions/sess1") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            id: "sess1",
            routineId: routine.id,
            startedAt: "2024-01-01T00:00:00.000Z",
            finishedAt: null,
            setLogs: [],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/exercises")) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 });
    }),
  );
}

describe("RoutineDetailPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("routine-tracker:token", "fake-token");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renderiza la rutina con sus ejercicios", async () => {
    stubApi(baseRoutine());

    renderWithProviders(["/routines/r1"]);

    expect(await screen.findByText("Push Day")).toBeInTheDocument();
    expect(screen.getByText("Press banca")).toBeInTheDocument();
    expect(screen.getByText(/3 series x 8-12 reps · Hipertrofia/)).toBeInTheDocument();
    expect(screen.getByText("Pecho")).toBeInTheDocument();
  });

  it("muestra los días de entreno ordenados por día de semana", async () => {
    stubApi(baseRoutine({ trainingDays: ["THU", "MON"] }));

    renderWithProviders(["/routines/r1"]);

    expect(await screen.findByText(/1 ejercicio · Lun, Jue/)).toBeInTheDocument();
  });

  it("edita un ejercicio y usa la sugerencia de rango de repeticiones", async () => {
    stubApi(baseRoutine());

    renderWithProviders(["/routines/r1"]);

    await screen.findByText("Press banca");

    fireEvent.click(screen.getByRole("button", { name: "Editar ejercicio" }));

    const useSuggestionButton = await screen.findByRole("button", { name: "Usar sugerencia" });
    fireEvent.click(useSuggestionButton);

    expect(await screen.findByLabelText("Reps min")).toHaveValue(5);
    expect(screen.getByLabelText("Reps max")).toHaveValue(8);
  });

  it("inicia una sesión desde la rutina", async () => {
    stubApi(baseRoutine());

    renderWithProviders(["/routines/r1"]);

    await screen.findByText("Push Day");

    fireEvent.click(screen.getByRole("button", { name: "Iniciar entrenamiento" }));

    expect(await screen.findByRole("button", { name: "Finalizar" })).toBeInTheDocument();
  });
});
