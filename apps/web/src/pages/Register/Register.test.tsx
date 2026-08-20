import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

function stubAuthFlow({ registerFails }: { registerFails: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";

      if (url.endsWith("/auth/register") && method === "POST") {
        if (registerFails) {
          return new Response(JSON.stringify({ error: "El email ya está registrado" }), { status: 409 });
        }
        return new Response(
          JSON.stringify({
            id: "1",
            email: "new@user.com",
            name: null,
            birthDate: null,
            age: null,
            unitPreference: "KG",
            createdAt: "2024-01-01",
          }),
          { status: 201 },
        );
      }
      if (url.endsWith("/auth/login") && method === "POST") {
        return new Response(JSON.stringify({ token: "new-token" }), { status: 200 });
      }
      if (url.endsWith("/auth/me")) {
        return new Response(
          JSON.stringify({
            id: "1",
            email: "new@user.com",
            name: null,
            birthDate: null,
            age: null,
            unitPreference: "KG",
            createdAt: "2024-01-01",
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/routines")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 });
    }),
  );
}

describe("RegisterPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("crea la cuenta y redirige a /routines", async () => {
    stubAuthFlow({ registerFails: false });

    renderWithProviders(["/register"]);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@user.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "supersecret" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Todavía no tienes rutinas, crea la primera.")).toBeInTheDocument();
  });

  it("muestra un error cuando el registro falla", async () => {
    stubAuthFlow({ registerFails: true });

    renderWithProviders(["/register"]);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "dup@user.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "supersecret" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El email ya está registrado");
  });
});
