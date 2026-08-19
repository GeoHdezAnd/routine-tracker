import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

type Dashboard = {
  recentSessions: Array<{
    id: string;
    startedAt: string;
    finishedAt: string | null;
    routineId: string | null;
    routineName: string | null;
  }>;
  routines: Array<{ id: string; name: string }>;
  readyToProgress: Array<{ exerciseId: string; exerciseName: string; suggestedWeightIncrease: number }>;
};

function stubMeAndDashboard(dashboard: Dashboard) {
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
      if (url.endsWith("/dashboard")) {
        return new Response(JSON.stringify(dashboard), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 });
    }),
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("routine-tracker:token", "fake-token");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renderiza sesiones recientes, rutinas y sugerencias de progreso", async () => {
    stubMeAndDashboard({
      recentSessions: [
        { id: "s1", startedAt: "2024-01-10T00:00:00.000Z", finishedAt: null, routineId: "r1", routineName: "Push Day" },
      ],
      routines: [{ id: "r1", name: "Push Day" }],
      readyToProgress: [{ exerciseId: "e1", exerciseName: "Press banca", suggestedWeightIncrease: 2.5 }],
    });

    renderWithProviders(["/"]);

    expect(await screen.findByText("Hola, Geo")).toBeInTheDocument();
    expect(await screen.findByText("Press banca")).toBeInTheDocument();
    expect(screen.getByText("+2.5kg sugerido")).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
    expect(screen.getAllByText("Push Day").length).toBeGreaterThan(0);
  });

  it("muestra el estado vacío cuando no hay sesiones ni rutinas", async () => {
    stubMeAndDashboard({ recentSessions: [], routines: [], readyToProgress: [] });

    renderWithProviders(["/"]);

    expect(await screen.findByText("Todavía no tenés nada cargado.")).toBeInTheDocument();
  });
});
