import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs in successfully, stores the token, and navigates to the dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/auth/login")) {
          return new Response(JSON.stringify({ token: "fake-token" }), { status: 200 });
        }
        if (url.endsWith("/auth/me")) {
          return new Response(
            JSON.stringify({
              id: "1",
              email: "a@b.com",
              name: null,
              birthDate: null,
              age: null,
              unitPreference: "KG",
              createdAt: "2024-01-01",
            }),
            { status: 200 },
          );
        }
        if (url.includes("/dashboard")) {
          return new Response(
            JSON.stringify({
              dayStreak: 0,
              sessionsThisWeek: 0,
              totalWorkouts: 0,
              today: null,
              recentSessions: [],
              routines: [],
              readyToProgress: [],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 });
      }),
    );

    renderWithProviders(["/login"]);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "supersecret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByText("Todavía no tienes nada cargado.")).toBeInTheDocument();
    expect(localStorage.getItem("routine-tracker:token")).toBe("fake-token");
  });

  it("muestra el error de la API cuando el login falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Email o contraseña inválidos" }), { status: 401 })),
    );

    renderWithProviders(["/login"]);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "wrongpass" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email o contraseña inválidos");
  });
});
