import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/render-with-providers";

function stubMeAndRoutines(routines: Array<{ id: string; name: string; createdAt: string }>) {
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
      if (url.endsWith("/routines")) {
        return new Response(JSON.stringify(routines), { status: 200 });
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
});
