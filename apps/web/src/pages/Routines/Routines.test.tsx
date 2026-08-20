import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

type Routine = { id: string; name: string; createdAt: string; archived?: boolean };

function stubMeAndRoutines(initialRoutines: Routine[]) {
  let routines = initialRoutines.map((routine) => ({ archived: false, ...routine }));

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
      if (url.includes("/routines") && (!init?.method || init.method === "GET")) {
        const archived = url.includes("archived=true");
        return new Response(JSON.stringify(routines.filter((routine) => routine.archived === archived)), {
          status: 200,
        });
      }
      if (url.match(/\/routines\/[^/]+$/) && init?.method === "PATCH") {
        const routineId = url.split("/").pop();
        const body = JSON.parse(String(init.body)) as { archived: boolean };
        routines = routines.map((routine) =>
          routine.id === routineId ? { ...routine, archived: body.archived } : routine,
        );
        return new Response(JSON.stringify(routines.find((routine) => routine.id === routineId)), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 });
    }),
  );
}

describe("RoutinesPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("routine-tracker:token", "fake-token");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renderiza las rutinas devueltas por la API", async () => {
    stubMeAndRoutines([{ id: "r1", name: "Push Day", createdAt: "2024-01-01" }]);

    renderWithProviders(["/routines"]);

    expect(await screen.findByText("Push Day")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay rutinas", async () => {
    stubMeAndRoutines([]);

    renderWithProviders(["/routines"]);

    expect(await screen.findByText("Todavía no tenés rutinas, creá la primera.")).toBeInTheDocument();
  });

  it("archiva una rutina y la muestra en la pestaña de archivadas", async () => {
    stubMeAndRoutines([{ id: "r1", name: "Push Day", createdAt: "2024-01-01" }]);

    renderWithProviders(["/routines"]);

    fireEvent.click(await screen.findByRole("button", { name: "Archivar rutina" }));

    expect(await screen.findByText("Todavía no tenés rutinas, creá la primera.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Archivadas"));

    expect(await screen.findByText("Push Day")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Restaurar rutina" })).toBeInTheDocument();
  });
});
