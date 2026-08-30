import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

type Session = { id: string; routineId: string | null; startedAt: string; finishedAt: string | null };

function thisMonthIso(day: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day, 10, 0, 0).toISOString();
}

function stubApi(initialSessions: Session[]) {
  let sessions = initialSessions;

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
      if (url.endsWith("/sessions") && (!init?.method || init.method === "GET")) {
        return new Response(JSON.stringify(sessions), { status: 200 });
      }
      if (url.endsWith("/sessions") && init?.method === "POST") {
        const created: Session = {
          id: "new-session",
          routineId: null,
          startedAt: "2024-02-01T00:00:00.000Z",
          finishedAt: null,
        };
        sessions = [...sessions, created];
        return new Response(JSON.stringify(created), { status: 201 });
      }
      if (url.endsWith("/sessions/new-session")) {
        return new Response(
          JSON.stringify({
            id: "new-session",
            routineId: null,
            startedAt: "2024-02-01T00:00:00.000Z",
            finishedAt: null,
            setLogs: [],
          }),
          { status: 200 },
        );
      }
      if (url.match(/\/sessions\/[^/]+$/) && init?.method === "DELETE") {
        const sessionId = url.split("/").pop();
        sessions = sessions.filter((session) => session.id !== sessionId);
        return new Response(null, { status: 204 });
      }
      if (url.includes("/exercises")) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 });
    }),
  );
}

describe("SessionsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("routine-tracker:token", "fake-token");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renderiza las sesiones devueltas por la API", async () => {
    stubApi([{ id: "s1", routineId: null, startedAt: thisMonthIso(15), finishedAt: null }]);

    renderWithProviders(["/sessions"]);

    expect(await screen.findByText("En curso")).toBeInTheDocument();
  });

  it("crea una sesión libre y navega a su detalle", async () => {
    stubApi([]);

    renderWithProviders(["/sessions"]);

    expect(await screen.findByText("Todavía no registraste ninguna sesión.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nueva sesión libre" }));

    expect(await screen.findByRole("button", { name: "Finalizar" })).toBeInTheDocument();
  });

  it("borra una sesión desde el diálogo de confirmación", async () => {
    stubApi([{ id: "s1", routineId: null, startedAt: thisMonthIso(15), finishedAt: null }]);

    renderWithProviders(["/sessions"]);

    await screen.findByText("En curso");

    fireEvent.click(screen.getByRole("button", { name: "Borrar sesión" }));

    expect(screen.getByText("Borrar sesión")).toBeInTheDocument();

    const confirmButtons = screen.getAllByRole("button", { name: "Borrar" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

    expect(await screen.findByText("Todavía no registraste ninguna sesión.")).toBeInTheDocument();
  });
});
