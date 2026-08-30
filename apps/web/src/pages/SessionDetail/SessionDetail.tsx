import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Loader2, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { colorForLabel } from "../../lib/colors";
import { displayToKg, kgToDisplay, unitLabel } from "../../lib/units";
import { Button, IconButton, Select } from "../../components/ui";

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

type Exercise = { id: string; name: string; muscleGroup: string };
type ExercisesResponse = { data: Exercise[] };

type RoutineExercise = { targetSets: number; exercise: Exercise };
type RoutineDetail = { name: string; exercises: RoutineExercise[] };

type DraftRow = { key: number; weightDisplay: string; reps: string };

type ExerciseEntry = { exerciseId: string; name: string; muscleGroup: string; targetSets: number | null };

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const unit = user?.unitPreference ?? "KG";
  const queryClient = useQueryClient();

  const [drafts, setDrafts] = useState<Record<string, DraftRow[]>>({});
  const [manualExerciseIds, setManualExerciseIds] = useState<string[]>([]);
  const [hiddenExerciseIds, setHiddenExerciseIds] = useState<string[]>([]);
  const [newExerciseId, setNewExerciseId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [logError, setLogError] = useState<string | null>(null);
  const nextDraftKey = useRef(0);
  const hasSeededDrafts = useRef(false);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", id, token],
    queryFn: () => apiFetch<Session>(`/sessions/${id}`, { token }),
    enabled: id !== undefined,
  });

  const { data: routine } = useQuery({
    queryKey: ["routine", session?.routineId, token],
    queryFn: () => apiFetch<RoutineDetail>(`/routines/${session!.routineId}`, { token }),
    enabled: session?.routineId !== null && session?.routineId !== undefined,
  });

  const { data: exercisesData } = useQuery({
    queryKey: ["exercises-for-session", token],
    queryFn: () => apiFetch<ExercisesResponse>("/exercises?limit=100", { token }),
  });

  const isFinished = session?.finishedAt !== null && session?.finishedAt !== undefined;

  useEffect(() => {
    if (!session) return;

    if (isFinished) {
      const finishedAt = session.finishedAt!;
      setElapsed(Math.max(0, Math.floor((new Date(finishedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)));
      return;
    }

    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session, isFinished]);

  const routineExerciseEntries: ExerciseEntry[] =
    routine?.exercises.map((re) => ({
      exerciseId: re.exercise.id,
      name: re.exercise.name,
      muscleGroup: re.exercise.muscleGroup,
      targetSets: re.targetSets,
    })) ?? [];

  useEffect(() => {
    if (hasSeededDrafts.current || !session) return;
    if (session.routineId && !routine) return;
    hasSeededDrafts.current = true;

    const loggedCounts = new Map<string, number>();
    for (const log of session.setLogs) {
      loggedCounts.set(log.exerciseId, (loggedCounts.get(log.exerciseId) ?? 0) + 1);
    }

    const seeded: Record<string, DraftRow[]> = {};
    for (const entry of routineExerciseEntries) {
      const missing = (entry.targetSets ?? 0) - (loggedCounts.get(entry.exerciseId) ?? 0);
      if (missing > 0) {
        seeded[entry.exerciseId] = Array.from({ length: missing }, () => ({
          key: nextDraftKey.current++,
          weightDisplay: "",
          reps: "",
        }));
      }
    }
    setDrafts(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, routine]);

  function invalidateSession() {
    void queryClient.invalidateQueries({ queryKey: ["session", id] });
  }

  const addLog = useMutation({
    mutationFn: (input: { exerciseId: string; weightKg: number; reps: number; draftKey: number }) =>
      apiFetch(`/sessions/${id}/logs`, {
        method: "POST",
        token,
        body: { exerciseId: input.exerciseId, weightKg: input.weightKg, reps: input.reps },
      }),
    onSuccess: (_data, variables) => {
      setLogError(null);
      invalidateSession();
      setDrafts((current) => ({
        ...current,
        [variables.exerciseId]: (current[variables.exerciseId] ?? []).filter((row) => row.key !== variables.draftKey),
      }));
    },
    onError: (error: unknown) => {
      setLogError(error instanceof ApiError ? error.message : "No se pudo guardar la serie, revisá tu conexión.");
    },
  });

  const deleteLog = useMutation({
    mutationFn: (logId: string) => apiFetch(`/sessions/${id}/logs/${logId}`, { method: "DELETE", token }),
    onSuccess: () => invalidateSession(),
  });

  const finishSession = useMutation({
    mutationFn: () => apiFetch(`/sessions/${id}/finish`, { method: "POST", token }),
    onSuccess: () => invalidateSession(),
  });

  function updateDraft(exerciseId: string, key: number, field: "weightDisplay" | "reps", value: string) {
    setDrafts((current) => ({
      ...current,
      [exerciseId]: (current[exerciseId] ?? []).map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    }));
  }

  function addDraftRow(exerciseId: string) {
    setDrafts((current) => ({
      ...current,
      [exerciseId]: [...(current[exerciseId] ?? []), { key: nextDraftKey.current++, weightDisplay: "", reps: "" }],
    }));
  }

  function removeDraftRow(exerciseId: string, key: number) {
    setDrafts((current) => ({
      ...current,
      [exerciseId]: (current[exerciseId] ?? []).filter((row) => row.key !== key),
    }));
  }

  function saveDraftRow(exerciseId: string, row: DraftRow) {
    const weightDisplay = Number(row.weightDisplay);
    const reps = Number(row.reps);
    if (!row.weightDisplay || !row.reps || Number.isNaN(weightDisplay) || Number.isNaN(reps)) return;
    const weightKg = displayToKg(weightDisplay, unit);
    addLog.mutate({ exerciseId, weightKg, reps, draftKey: row.key });
  }

  function handleAddExercise(event: FormEvent) {
    event.preventDefault();
    if (!newExerciseId) return;
    setManualExerciseIds((current) => (current.includes(newExerciseId) ? current : [...current, newExerciseId]));
    setDrafts((current) => ({
      ...current,
      [newExerciseId]: current[newExerciseId] ?? [{ key: nextDraftKey.current++, weightDisplay: "", reps: "" }],
    }));
    setNewExerciseId("");
  }

  if (isLoading || !session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-canvas px-4 pt-8 pb-24 text-fg">
        <Link to="/sessions" className="flex items-center gap-0.5 text-sm font-medium text-accent">
          <ChevronLeft className="size-4" />
          Sesiones
        </Link>
        {isLoading && <p className="text-fg-muted">Cargando...</p>}
      </main>
    );
  }

  const exerciseById = new Map((exercisesData?.data ?? []).map((exercise) => [exercise.id, exercise]));
  const loggedExerciseIds = new Set(session.setLogs.map((log) => log.exerciseId));

  const extraEntries: ExerciseEntry[] = [...loggedExerciseIds, ...manualExerciseIds]
    .filter((exId, index, all) => all.indexOf(exId) === index)
    .filter((exId) => !routineExerciseEntries.some((entry) => entry.exerciseId === exId))
    .map((exId) => {
      const exercise = exerciseById.get(exId);
      return { exerciseId: exId, name: exercise?.name ?? exId, muscleGroup: exercise?.muscleGroup ?? "", targetSets: null };
    });

  const entries = [...routineExerciseEntries, ...extraEntries].filter(
    (entry) => !hiddenExerciseIds.includes(entry.exerciseId),
  );

  const totalTarget = routine ? routineExerciseEntries.reduce((sum, entry) => sum + (entry.targetSets ?? 0), 0) : null;
  const addedExerciseIds = new Set(entries.map((entry) => entry.exerciseId));
  const availableToAdd = (exercisesData?.data ?? []).filter((exercise) => !addedExerciseIds.has(exercise.id));

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 bg-canvas px-4 pt-4 pb-24 text-fg">
      <Link to="/sessions" className="flex items-center gap-0.5 text-sm font-medium text-accent">
        <ChevronLeft className="size-4" />
        Sesiones
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-fg-muted">{routine?.name ?? "Sesión libre"}</p>
          <p className="font-mono text-3xl font-bold tabular-nums">{formatElapsed(elapsed)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-fg-muted">
            {session.setLogs.length}
            {totalTarget !== null ? `/${totalTarget}` : ""} series
          </span>
          {isFinished ? (
            <span className="text-sm font-medium text-gray-400 bg-red-600/20 px-2 py-1 rounded-2xl">Finalizada</span>
          ) : (
            <button
              type="button"
              onClick={() => finishSession.mutate()}
              disabled={finishSession.isPending}
              className="flex items-center gap-1.5 rounded-full bg-group-2 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {finishSession.isPending && <Loader2 className="size-4 animate-spin" />}
              Finalizar
            </button>
          )}
        </div>
      </div>

      {logError && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {logError}
        </p>
      )}

      {entries.length === 0 && (
        <p className="text-fg-muted">Todavía no agregaste ejercicios a esta sesión.</p>
      )}

      <div className="flex flex-col gap-3">
        {entries.map((entry) => {
          const color = colorForLabel(entry.muscleGroup || entry.name);
          const savedRows = session.setLogs.filter((log) => log.exerciseId === entry.exerciseId);
          const draftRows = drafts[entry.exerciseId] ?? [];

          return (
            <div key={entry.exerciseId} className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className={`size-2.5 shrink-0 rounded-full ${color.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{entry.name}</p>
                  {entry.muscleGroup && (
                    <span
                      className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${color.soft} ${color.fg}`}
                    >
                      {entry.muscleGroup}
                    </span>
                  )}
                </div>
                {!isFinished && (
                  <IconButton
                    aria-label={`Quitar ${entry.name} de la sesión`}
                    className="size-7 shrink-0"
                    onClick={() => setHiddenExerciseIds((current) => [...current, entry.exerciseId])}
                  >
                    <X className="size-4" />
                  </IconButton>
                )}
              </div>

              <div className="grid grid-cols-[1.5rem_1fr_1fr_2rem] items-center gap-x-2 gap-y-1.5">
                <span className="text-xs font-medium text-fg-muted uppercase">Set</span>
                <span className="text-center text-xs font-medium text-fg-muted uppercase">{unitLabel(unit)}</span>
                <span className="text-center text-xs font-medium text-fg-muted uppercase">Reps</span>
                <span />

                {savedRows.map((log) => (
                  <div key={log.id} className="contents">
                    <span className="text-sm text-fg-muted">{log.setNumber}</span>
                    <span className="rounded-lg bg-surface-muted px-2 py-1.5 text-center text-sm font-medium">
                      {kgToDisplay(log.weightKg, unit)}
                    </span>
                    <span className="rounded-lg bg-surface-muted px-2 py-1.5 text-center text-sm font-medium">
                      {log.reps}
                    </span>
                    {isFinished ? (
                      <span className="flex size-8 items-center justify-center rounded-full bg-group-2-soft text-group-2">
                        <Check className="size-4" />
                      </span>
                    ) : (
                      <IconButton
                        aria-label="Borrar serie"
                        className="size-8 text-danger hover:bg-danger-soft"
                        onClick={() => deleteLog.mutate(log.id)}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    )}
                  </div>
                ))}

                {!isFinished &&
                  draftRows.map((row, index) => (
                    <div key={row.key} className="contents">
                      <span className="text-sm text-fg-muted">{savedRows.length + index + 1}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        aria-label={`Peso serie ${savedRows.length + index + 1} de ${entry.name}`}
                        value={row.weightDisplay}
                        onChange={(event) => updateDraft(entry.exerciseId, row.key, "weightDisplay", event.target.value)}
                        className="w-full rounded-lg border border-border bg-canvas px-2 py-1.5 text-center text-sm font-medium"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        aria-label={`Repeticiones serie ${savedRows.length + index + 1} de ${entry.name}`}
                        value={row.reps}
                        onChange={(event) => updateDraft(entry.exerciseId, row.key, "reps", event.target.value)}
                        className="w-full rounded-lg border border-border bg-canvas px-2 py-1.5 text-center text-sm font-medium"
                      />
                      <div className="flex items-center gap-0.5">
                        <IconButton
                          aria-label={`Guardar serie ${savedRows.length + index + 1} de ${entry.name}`}
                          className="size-8"
                          disabled={!row.weightDisplay || !row.reps || addLog.isPending}
                          onClick={() => saveDraftRow(entry.exerciseId, row)}
                        >
                          {addLog.isPending && addLog.variables?.draftKey === row.key ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </IconButton>
                        {draftRows.length > 1 && (
                          <IconButton
                            aria-label={`Quitar fila de serie ${savedRows.length + index + 1} de ${entry.name}`}
                            className="size-8 text-fg-subtle"
                            onClick={() => removeDraftRow(entry.exerciseId, row.key)}
                          >
                            <X className="size-3.5" />
                          </IconButton>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              {!isFinished && (
                <button
                  type="button"
                  onClick={() => addDraftRow(entry.exerciseId)}
                  className="mt-2 flex w-full items-center justify-center gap-1 text-sm font-semibold text-accent"
                >
                  <Plus className="size-4" />
                  Agregar serie
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!isFinished && availableToAdd.length > 0 && (
        <form onSubmit={handleAddExercise} className="flex gap-2">
          <Select value={newExerciseId} onChange={setNewExerciseId} className="flex-1">
            <option value="">Agregar ejercicio...</option>
            {availableToAdd.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={!newExerciseId} className="shrink-0 px-4">
            Agregar
          </Button>
        </form>
      )}
    </main>
  );
}
