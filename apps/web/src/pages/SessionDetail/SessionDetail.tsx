import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { Button, Card, FieldLabel, Input, Select } from "../../components/ui";

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

type Exercise = { id: string; name: string };
type ExercisesResponse = { data: Exercise[] };

function groupByExercise(logs: SetLog[]): Map<string, SetLog[]> {
  const groups = new Map<string, SetLog[]>();
  for (const log of logs) {
    const group = groups.get(log.exerciseId);
    if (group) {
      group.push(log);
    } else {
      groups.set(log.exerciseId, [log]);
    }
  }
  return groups;
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [exerciseId, setExerciseId] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState("");
  const [note, setNote] = useState("");
  const [logError, setLogError] = useState<string | null>(null);

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editWeightKg, setEditWeightKg] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editRir, setEditRir] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", id, token],
    queryFn: () => apiFetch<Session>(`/sessions/${id}`, { token }),
    enabled: id !== undefined,
  });

  const { data: exercisesData } = useQuery({
    queryKey: ["exercises-for-session", token],
    queryFn: () => apiFetch<ExercisesResponse>("/exercises?limit=100", { token }),
  });

  const exerciseNames = new Map((exercisesData?.data ?? []).map((exercise) => [exercise.id, exercise.name]));

  function invalidateSession() {
    void queryClient.invalidateQueries({ queryKey: ["session", id] });
  }

  const addLog = useMutation({
    mutationFn: () =>
      apiFetch(`/sessions/${id}/logs`, {
        method: "POST",
        token,
        body: {
          exerciseId,
          weightKg: Number(weightKg),
          reps: Number(reps),
          rir: rir ? Number(rir) : undefined,
          note: note || undefined,
        },
      }),
    onSuccess: () => {
      invalidateSession();
      setWeightKg("");
      setReps("");
      setRir("");
      setNote("");
    },
    onError: (mutationError: unknown) => {
      setLogError(mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado");
    },
  });

  const deleteLog = useMutation({
    mutationFn: (logId: string) => apiFetch(`/sessions/${id}/logs/${logId}`, { method: "DELETE", token }),
    onSuccess: () => invalidateSession(),
  });

  const updateLog = useMutation({
    mutationFn: (logId: string) =>
      apiFetch(`/sessions/${id}/logs/${logId}`, {
        method: "PATCH",
        token,
        body: {
          weightKg: Number(editWeightKg),
          reps: Number(editReps),
          rir: editRir ? Number(editRir) : undefined,
          note: editNote || undefined,
        },
      }),
    onSuccess: () => {
      setEditingLogId(null);
      invalidateSession();
    },
    onError: (mutationError: unknown) => {
      setEditError(
        mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado",
      );
    },
  });

  function startEditingLog(log: SetLog) {
    setEditingLogId(log.id);
    setEditWeightKg(String(log.weightKg));
    setEditReps(String(log.reps));
    setEditRir(log.rir !== null ? String(log.rir) : "");
    setEditNote(log.note ?? "");
    setEditError(null);
  }

  const finishSession = useMutation({
    mutationFn: () => apiFetch(`/sessions/${id}/finish`, { method: "POST", token }),
    onSuccess: () => invalidateSession(),
  });

  function handleAddLog(event: FormEvent) {
    event.preventDefault();
    setLogError(null);
    if (!exerciseId || !weightKg || !reps) return;
    addLog.mutate();
  }

  const isFinished = session?.finishedAt !== null && session?.finishedAt !== undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-neutral-950 px-4 py-8 text-neutral-100">
      <Link to="/sessions" className="text-sm text-neutral-400 underline">
        ← Volver a sesiones
      </Link>

      {isLoading && <p className="text-neutral-400">Cargando...</p>}

      {session && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Sesión</h1>
              <p className="text-sm text-neutral-400">{new Date(session.startedAt).toLocaleString()}</p>
            </div>
            {isFinished ? (
              <span className="text-sm text-neutral-500">Finalizada</span>
            ) : (
              <Button variant="secondary" onClick={() => finishSession.mutate()} disabled={finishSession.isPending}>
                Finalizar sesión
              </Button>
            )}
          </div>

          {session.setLogs.length === 0 && <p className="text-neutral-400">Todavía no registraste ninguna serie.</p>}

          <ul className="flex flex-col gap-3">
            {[...groupByExercise(session.setLogs).entries()].map(([exId, logs]) => (
              <li key={exId}>
                <p className="mb-1 font-medium">{exerciseNames.get(exId) ?? exId}</p>
                <ul className="flex flex-col gap-1">
                  {logs.map((log) =>
                    editingLogId === log.id ? (
                      <Card key={log.id} className="flex flex-col gap-2">
                        <form
                          className="flex flex-col gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            updateLog.mutate(log.id);
                          }}
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <FieldLabel>
                              Peso (kg)
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={editWeightKg}
                                onChange={(event) => setEditWeightKg(event.target.value)}
                              />
                            </FieldLabel>
                            <FieldLabel>
                              Reps
                              <Input
                                type="number"
                                inputMode="numeric"
                                value={editReps}
                                onChange={(event) => setEditReps(event.target.value)}
                              />
                            </FieldLabel>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <FieldLabel>
                              RIR (opcional)
                              <Input
                                type="number"
                                min={0}
                                max={5}
                                value={editRir}
                                onChange={(event) => setEditRir(event.target.value)}
                              />
                            </FieldLabel>
                            <FieldLabel>
                              Nota (opcional)
                              <Input value={editNote} onChange={(event) => setEditNote(event.target.value)} />
                            </FieldLabel>
                          </div>
                          {editError && (
                            <p role="alert" className="text-sm text-red-400">
                              {editError}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Button type="submit" className="px-3 py-1 text-sm" disabled={updateLog.isPending}>
                              Guardar
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className="px-3 py-1 text-sm"
                              onClick={() => setEditingLogId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      </Card>
                    ) : (
                      <Card key={log.id} className="flex items-center justify-between">
                        <span className="text-sm">
                          Serie {log.setNumber}: {log.weightKg}kg x {log.reps} reps
                          {log.rir !== null ? ` · RIR ${log.rir}` : ""}
                          {log.note ? ` · ${log.note}` : ""}
                        </span>
                        {!isFinished && (
                          <div className="flex shrink-0 gap-2">
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              onClick={() => startEditingLog(log)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="danger"
                              className="px-2 py-1 text-xs"
                              onClick={() => deleteLog.mutate(log.id)}
                            >
                              Borrar
                            </Button>
                          </div>
                        )}
                      </Card>
                    ),
                  )}
                </ul>
              </li>
            ))}
          </ul>

          {!isFinished && (
            <form onSubmit={handleAddLog} className="flex flex-col gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3">
              <FieldLabel>
                Ejercicio
                <Select value={exerciseId} onChange={(event) => setExerciseId(event.target.value)}>
                  <option value="">Elegí un ejercicio</option>
                  {exercisesData?.data.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </Select>
              </FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <FieldLabel>
                  Peso (kg)
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={weightKg}
                    onChange={(event) => setWeightKg(event.target.value)}
                  />
                </FieldLabel>
                <FieldLabel>
                  Reps
                  <Input type="number" inputMode="numeric" value={reps} onChange={(event) => setReps(event.target.value)} />
                </FieldLabel>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FieldLabel>
                  RIR (opcional)
                  <Input type="number" min={0} max={5} value={rir} onChange={(event) => setRir(event.target.value)} />
                </FieldLabel>
                <FieldLabel>
                  Nota (opcional)
                  <Input value={note} onChange={(event) => setNote(event.target.value)} />
                </FieldLabel>
              </div>
              {logError && (
                <p role="alert" className="text-sm text-red-400">
                  {logError}
                </p>
              )}
              <Button type="submit" disabled={addLog.isPending} className="py-3 text-base">
                Registrar serie
              </Button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
