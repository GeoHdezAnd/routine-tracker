import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

type Dashboard = {
  dayStreak: number;
  sessionsThisWeek: number;
  totalWorkouts: number;
  today: { routineId: string; routineName: string; exerciseCount: number } | null;
  recentSessions: Array<{
    id: string;
    startedAt: string;
    finishedAt: string | null;
    routineId: string | null;
    routineName: string | null;
    durationSeconds: number | null;
    volumeKg: number;
  }>;
  routines: Array<{ id: string; name: string }>;
  readyToProgress: Array<{ exerciseId: string; exerciseName: string; suggestedWeightIncrease: number }>;
};

function stubMeAndDashboard(dashboard: Dashboard) {
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
      if (url.includes("/dashboard")) {
        return new Response(JSON.stringify(dashboard), { status: 200 });
      }
      if (url.endsWith("/sessions") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "new-session" }), { status: 201 });
      }
      if (url.endsWith("/sessions/new-session") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({ id: "new-session", routineId: null, startedAt: new Date().toISOString(), finishedAt: null, setLogs: [] }),
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

describe("DashboardPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("routine-tracker:token", "fake-token");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renderiza estadísticas, el entreno de hoy, sesiones recientes y sugerencias de progreso", async () => {
    stubMeAndDashboard({
      dayStreak: 3,
      sessionsThisWeek: 2,
      totalWorkouts: 20,
      today: { routineId: "r1", routineName: "Push Day", exerciseCount: 7 },
      recentSessions: [
        {
          id: "s1",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          routineId: "r1",
          routineName: "Push Day",
          durationSeconds: 2700,
          volumeKg: 6213,
        },
      ],
      routines: [{ id: "r1", name: "Push Day" }],
      readyToProgress: [{ exerciseId: "e1", exerciseName: "Press banca", suggestedWeightIncrease: 2.5 }],
    });

    renderWithProviders(["/"]);

    expect(await screen.findByText(/Geo/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7 ejercicios")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar" })).toBeInTheDocument();
    expect(screen.getByText("Press banca")).toBeInTheDocument();
    expect(screen.getByText("+2.5kg sugerido")).toBeInTheDocument();
    expect(screen.getByText("6213")).toBeInTheDocument();
    expect(screen.getByText(/45:00/)).toBeInTheDocument();
  });

  it("inicia una sesión desde la tarjeta de Hoy", async () => {
    stubMeAndDashboard({
      dayStreak: 0,
      sessionsThisWeek: 0,
      totalWorkouts: 0,
      today: { routineId: "r1", routineName: "Push Day", exerciseCount: 7 },
      recentSessions: [],
      routines: [{ id: "r1", name: "Push Day" }],
      readyToProgress: [],
    });

    renderWithProviders(["/"]);

    fireEvent.click(await screen.findByRole("button", { name: "Iniciar" }));

    expect(await screen.findByRole("button", { name: "Finalizar" })).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay nada cargado", async () => {
    stubMeAndDashboard({
      dayStreak: 0,
      sessionsThisWeek: 0,
      totalWorkouts: 0,
      today: null,
      recentSessions: [],
      routines: [],
      readyToProgress: [],
    });

    renderWithProviders(["/"]);

    expect(await screen.findByText("Todavía no tienes nada cargado.")).toBeInTheDocument();
  });
});
