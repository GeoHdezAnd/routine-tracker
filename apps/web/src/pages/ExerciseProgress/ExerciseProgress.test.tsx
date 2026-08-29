import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

type ProgressSet = {
  id: string;
  weightKg: number;
  reps: number;
  rir: number | null;
  estimated1RM: number;
  isTopOfDay: boolean;
};

type ProgressSession = { sessionId: string; date: string; sets: ProgressSet[]; isNewPR: boolean };

type ProgressSummary = {
  sessionCount: number;
  bestWeightKg: number | null;
  bestVolumeSet: { weightKg: number; reps: number } | null;
};

type ExerciseProgress = {
  summary: ProgressSummary;
  sessions: ProgressSession[];
  readyToProgress: boolean;
  suggestedWeightIncrease: number | null;
};

function stubMeAndProgress(progress: ExerciseProgress, unitPreference: "KG" | "LB" = "KG") {
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
            unitPreference,
            createdAt: "2024-01-01",
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/exercises/e1")) {
        return new Response(JSON.stringify({ name: "Press banca", muscleGroup: "Pecho" }), { status: 200 });
      }
      if (url.endsWith("/exercises/e1/progress")) {
        return new Response(JSON.stringify(progress), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 });
    }),
  );
}

describe("ExerciseProgressPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("routine-tracker:token", "fake-token");
    // recharts' ResponsiveContainer needs ResizeObserver, which jsdom doesn't implement.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renderiza las stat cards, el historial por sesión y el aviso de progreso sugerido", async () => {
    stubMeAndProgress({
      summary: { sessionCount: 3, bestWeightKg: 62.5, bestVolumeSet: { weightKg: 62.5, reps: 8 } },
      sessions: [
        {
          sessionId: "s1",
          date: "2024-01-05T00:00:00.000Z",
          isNewPR: false,
          sets: [{ id: "set1", weightKg: 60, reps: 8, rir: 2, estimated1RM: 72.5, isTopOfDay: true }],
        },
        {
          sessionId: "s2",
          date: "2024-01-08T00:00:00.000Z",
          isNewPR: false,
          sets: [{ id: "set2", weightKg: 55, reps: 8, rir: 2, estimated1RM: 65.7, isTopOfDay: true }],
        },
        {
          sessionId: "s3",
          date: "2024-01-12T00:00:00.000Z",
          isNewPR: true,
          sets: [{ id: "set3", weightKg: 62.5, reps: 8, rir: 1, estimated1RM: 75.2, isTopOfDay: true }],
        },
      ],
      readyToProgress: true,
      suggestedWeightIncrease: 2.5,
    });

    renderWithProviders(["/exercises/e1/progress"]);

    expect(await screen.findByText("Press banca")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("62.5")).toBeInTheDocument();
    expect(screen.getByText("62.5×8")).toBeInTheDocument();
    expect(screen.getByText(/Listo para subir peso: \+2.5kg/)).toBeInTheDocument();

    expect(screen.getByText(/60kg × 8/)).toBeInTheDocument();
    expect(screen.getByText(/55kg × 8/)).toBeInTheDocument();
    expect(screen.getByText(/62.5kg × 8/)).toBeInTheDocument();
    expect(screen.getAllByText("PR")).toHaveLength(1);
  });

  it("convierte los pesos a libras cuando esa es la preferencia del usuario", async () => {
    stubMeAndProgress(
      {
        summary: { sessionCount: 1, bestWeightKg: 60, bestVolumeSet: { weightKg: 60, reps: 8 } },
        sessions: [
          {
            sessionId: "s1",
            date: "2024-01-05T00:00:00.000Z",
            isNewPR: true,
            sets: [{ id: "set1", weightKg: 60, reps: 8, rir: 2, estimated1RM: 72.5, isTopOfDay: true }],
          },
        ],
        readyToProgress: true,
        suggestedWeightIncrease: 2.5,
      },
      "LB",
    );

    renderWithProviders(["/exercises/e1/progress"]);

    expect(await screen.findByText(/Listo para subir peso: \+5.5lb/)).toBeInTheDocument();
    expect(screen.getByText(/132.3lb × 8/)).toBeInTheDocument();
    expect(screen.getByText("132.3")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay series registradas", async () => {
    stubMeAndProgress({
      summary: { sessionCount: 0, bestWeightKg: null, bestVolumeSet: null },
      sessions: [],
      readyToProgress: false,
      suggestedWeightIncrease: null,
    });

    renderWithProviders(["/exercises/e1/progress"]);

    expect(
      await screen.findByText("Todavía no registraste series de este ejercicio."),
    ).toBeInTheDocument();
  });
});
