import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

type HistoryEntry = {
  sessionId: string;
  date: string;
  weightKg: number;
  reps: number;
  rir: number | null;
  estimated1RM: number;
};

type ExerciseProgress = {
  history: HistoryEntry[];
  readyToProgress: boolean;
  suggestedWeightIncrease: number | null;
};

function stubMeAndProgress(progress: ExerciseProgress) {
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

  it("renderiza el historial y el aviso de progreso sugerido", async () => {
    stubMeAndProgress({
      history: [
        { sessionId: "s1", date: "2024-01-05T00:00:00.000Z", weightKg: 60, reps: 8, rir: 2, estimated1RM: 72.5 },
        { sessionId: "s2", date: "2024-01-12T00:00:00.000Z", weightKg: 62.5, reps: 8, rir: 1, estimated1RM: 75 },
      ],
      readyToProgress: true,
      suggestedWeightIncrease: 2.5,
    });

    renderWithProviders(["/exercises/e1/progress"]);

    expect(await screen.findByText(/Listo para subir peso: \+2.5kg/)).toBeInTheDocument();
    expect(await screen.findByText(/60kg x 8/)).toBeInTheDocument();
    expect(screen.getByText(/62.5kg x 8/)).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay series registradas", async () => {
    stubMeAndProgress({ history: [], readyToProgress: false, suggestedWeightIncrease: null });

    renderWithProviders(["/exercises/e1/progress"]);

    expect(
      await screen.findByText("Todavía no registraste series de este ejercicio."),
    ).toBeInTheDocument();
  });
});
