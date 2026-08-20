import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render-with-providers";

type SetLog = {
  id: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rir: number | null;
  note: string | null;
};

type Session = {
  id: string;
  routineId: string | null;
  startedAt: string;
  finishedAt: string | null;
  setLogs: SetLog[];
};

const EXERCISES = [{ id: "ex1", name: "Sentadilla", muscleGroup: "Piernas" }];

function baseSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess1",
    routineId: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    setLogs: [],
    ...overrides,
  };
}

function stubApi(initialSession: Session) {
  let session = initialSession;

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
      if (url.endsWith(`/sessions/${session.id}`) && (!init?.method || init.method === "GET")) {
        return new Response(JSON.stringify(session), { status: 200 });
      }
      if (url.includes("/exercises")) {
        return new Response(JSON.stringify({ data: EXERCISES }), { status: 200 });
      }
      if (url.endsWith(`/sessions/${session.id}/logs`) && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { exerciseId: string; weightKg: number; reps: number };
        const newLog: SetLog = {
          id: `log-${session.setLogs.length + 1}`,
          exerciseId: body.exerciseId,
          setNumber: session.setLogs.filter((log) => log.exerciseId === body.exerciseId).length + 1,
          weightKg: body.weightKg,
          reps: body.reps,
          rir: null,
          note: null,
        };
        session = { ...session, setLogs: [...session.setLogs, newLog] };
        return new Response(JSON.stringify(newLog), { status: 201 });
      }
      if (url.match(/\/sessions\/[^/]+\/logs\/[^/]+$/) && init?.method === "DELETE") {
        const logId = url.split("/").pop();
        session = { ...session, setLogs: session.setLogs.filter((log) => log.id !== logId) };
        return new Response(null, { status: 204 });
      }
      if (url.endsWith(`/sessions/${session.id}/finish`) && init?.method === "POST") {
        session = { ...session, finishedAt: new Date().toISOString() };
        return new Response(JSON.stringify(session), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 });
    }),
  );
}

describe("SessionDetailPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("routine-tracker:token", "fake-token");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renderiza las series registradas de la sesión", async () => {
    stubApi(
      baseSession({
        setLogs: [{ id: "log1", exerciseId: "ex1", setNumber: 1, weightKg: 60, reps: 8, rir: 2, note: null }],
      }),
    );

    renderWithProviders(["/sessions/sess1"]);

    expect(await screen.findByText("Sentadilla")).toBeInTheDocument();
    expect(screen.getByText("Piernas")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("agrega un ejercicio y registra una serie", async () => {
    stubApi(baseSession());

    renderWithProviders(["/sessions/sess1"]);

    expect(await screen.findByText("Todavía no agregaste ejercicios a esta sesión.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ex1" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    expect(await screen.findByText("Sentadilla")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Peso serie 1 de Sentadilla"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Repeticiones serie 1 de Sentadilla"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar serie 1 de Sentadilla" }));

    expect(await screen.findByText("50")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("finaliza la sesión y oculta las acciones de edición", async () => {
    stubApi(
      baseSession({
        setLogs: [{ id: "log1", exerciseId: "ex1", setNumber: 1, weightKg: 60, reps: 8, rir: 2, note: null }],
      }),
    );

    renderWithProviders(["/sessions/sess1"]);

    fireEvent.click(await screen.findByRole("button", { name: "Finalizar" }));

    expect(await screen.findByText("Finalizada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrar serie" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar serie" })).not.toBeInTheDocument();
  });
});
