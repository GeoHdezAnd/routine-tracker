import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/render-with-providers";

describe("ProtectedLayout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("redirige a /login cuando no hay token", async () => {
    renderWithProviders(["/routines"]);

    expect(await screen.findByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
  });
});
