import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

function stubMe() {
  let me = {
    id: "1",
    email: "geo@test.com",
    name: "Geo",
    birthDate: null,
    age: null,
    unitPreference: "KG" as "KG" | "LB",
    createdAt: "2024-01-01",
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/me") && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { unitPreference: "KG" | "LB" };
        me = { ...me, unitPreference: body.unitPreference };
        return new Response(JSON.stringify(me), { status: 200 });
      }
      if (url.endsWith("/auth/me")) {
        return new Response(JSON.stringify(me), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 });
    }),
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("routine-tracker:token", "fake-token");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("muestra los datos del usuario y permite cambiar el tema", async () => {
    stubMe();

    renderWithProviders(["/settings"]);

    expect(await screen.findByText("Geo")).toBeInTheDocument();
    expect(screen.getByText("geo@test.com")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Claro"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(screen.getByText("Oscuro"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("cambia la unidad de peso a libras", async () => {
    stubMe();

    renderWithProviders(["/settings"]);

    expect(await screen.findByText("Geo")).toBeInTheDocument();

    const kgButton = screen.getByText("Kilogramos");
    const lbButton = screen.getByText("Libras");
    expect(kgButton.className).toContain("bg-accent");

    fireEvent.click(lbButton);

    await vi.waitFor(() => {
      expect(screen.getByText("Libras").className).toContain("bg-accent");
    });
    expect(screen.getByText("Kilogramos").className).not.toContain("bg-accent");
  });

  it("cierra sesión al hacer click en Cerrar sesión", async () => {
    stubMe();

    renderWithProviders(["/settings"]);

    expect(await screen.findByText("Geo")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cerrar sesión"));

    expect(await screen.findByText("Iniciar sesión")).toBeInTheDocument();
  });
});
