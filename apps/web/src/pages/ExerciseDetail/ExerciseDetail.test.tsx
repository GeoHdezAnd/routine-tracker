import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

const baseExercise = {
  id: "e1",
  name: "Press banca",
  muscleGroup: "Pecho",
  equipmentType: "Barra",
  movementType: "COMPOUND",
  imageUrl: null,
  ownerId: null,
};

function stubFetch(exercise: Record<string, unknown>) {
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
      if (url.endsWith("/exercises/e1")) {
        return new Response(JSON.stringify(exercise), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 });
    }),
  );
}

describe("ExerciseDetailPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("routine-tracker:token", "fake-token");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("muestra la guía completa y enlaza al progreso", async () => {
    stubFetch({
      ...baseExercise,
      startPosition: "Tumbado en el banco con los pies apoyados.",
      execution: "Baja la barra al pecho y empuja hacia arriba.",
      equipment: ["Barra", "Banco"],
      primaryMuscles: ["Pectorales"],
      secondaryMuscles: ["Tríceps"],
    });

    renderWithProviders(["/exercises/e1"]);

    expect(await screen.findByRole("heading", { name: "Press banca" })).toBeInTheDocument();
    expect(screen.getByText("Tumbado en el banco con los pies apoyados.")).toBeInTheDocument();
    expect(screen.getByText("Baja la barra al pecho y empuja hacia arriba.")).toBeInTheDocument();
    expect(screen.getByText("Banco")).toBeInTheDocument();
    expect(screen.getByText("Pectorales")).toBeInTheDocument();
    expect(screen.getByText("Tríceps")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver progreso/i })).toHaveAttribute("href", "/exercises/e1/progress");
  });

  it("avisa cuando un ejercicio propio no tiene guía", async () => {
    stubFetch({
      ...baseExercise,
      startPosition: null,
      execution: null,
      equipment: [],
      primaryMuscles: [],
      secondaryMuscles: [],
    });

    renderWithProviders(["/exercises/e1"]);

    expect(await screen.findByText("Este ejercicio no tiene guía.")).toBeInTheDocument();
  });

  it("muestra la imagen y cae al ícono si falla la carga", async () => {
    stubFetch({
      ...baseExercise,
      imageUrl: "https://example.com/press.png",
      startPosition: "Tumbado.",
      execution: "Empuja.",
      equipment: [],
      primaryMuscles: ["Pectorales"],
      secondaryMuscles: [],
    });

    const { container } = renderWithProviders(["/exercises/e1"]);

    await screen.findByRole("heading", { name: "Press banca" });
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.com/press.png");
    expect(img).toHaveClass("object-contain");

    fireEvent.error(img!);
    expect(container.querySelector("img")).toBeNull();
  });

  it("muestra un error si el ejercicio no existe", async () => {
    stubFetch({});
    renderWithProviders(["/exercises/missing"]);

    expect(await screen.findByText("No se pudo cargar el ejercicio.")).toBeInTheDocument();
  });
});
