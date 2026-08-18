import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MovementType, TrainingGoal } from "@routine-tracker/shared";
import { useAuth } from "../lib/auth";
import { apiFetch, ApiError } from "../lib/api";
import { Button, FieldLabel, Input, Select } from "../components/ui";

type Exercise = {
  id: string;
  name: string;
  movementType: MovementType;
};

type ExercisesResponse = { data: Exercise[] };

type RoutineExercise = {
  id: string;
  order: number;
  supersetSlot: number | null;
  goal: TrainingGoal;
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
  exercise: Exercise;
};

type RoutineDetail = {
  id: string;
  name: string;
  exercises: RoutineExercise[];
};

type Session = { id: string };

const GOAL_LABELS: Record<TrainingGoal, string> = {
  STRENGTH: "Fuerza",
  HYPERTROPHY: "Hipertrofia",
  ENDURANCE: "Resistencia",
};

function groupByOrder(exercises: RoutineExercise[]): RoutineExercise[][] {
  const groups = new Map<number, RoutineExercise[]>();
  for (const routineExercise of exercises) {
    const group = groups.get(routineExercise.order);
    if (group) {
      group.push(routineExercise);
    } else {
      groups.set(routineExercise.order, [routineExercise]);
    }
  }
  return [...groups.values()];
}

export function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [exerciseId, setExerciseId] = useState("");
  const [order, setOrder] = useState(1);
  const [supersetSlot, setSupersetSlot] = useState("");
  const [goal, setGoal] = useState<TrainingGoal>("HYPERTROPHY");
  const [targetSets, setTargetSets] = useState(3);
  const [targetRepMin, setTargetRepMin] = useState("");
  const [targetRepMax, setTargetRepMax] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const {
    data: routine,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["routine", id, token],
    queryFn: () => apiFetch<RoutineDetail>(`/routines/${id}`, { token }),
    enabled: id !== undefined,
  });

  const { data: exercisesData } = useQuery({
    queryKey: ["exercises-for-routine", token],
    queryFn: () => apiFetch<ExercisesResponse>("/exercises?limit=100", { token }),
    enabled: showAddForm,
  });

  function invalidateRoutine() {
    void queryClient.invalidateQueries({ queryKey: ["routine", id] });
  }

  const selectedExercise = exercisesData?.data.find((exercise) => exercise.id === exerciseId);

  function fillSuggestion() {
    if (!selectedExercise) return;
    apiFetch<{ targetRepMin: number; targetRepMax: number }>(
      `/routines/rep-range-suggestion?movementType=${selectedExercise.movementType}&goal=${goal}`,
      { token },
    ).then((suggestion) => {
      setTargetRepMin(String(suggestion.targetRepMin));
      setTargetRepMax(String(suggestion.targetRepMax));
    });
  }

  const addExercise = useMutation({
    mutationFn: () =>
      apiFetch(`/routines/${id}/exercises`, {
        method: "POST",
        token,
        body: {
          exerciseId,
          order,
          supersetSlot: supersetSlot ? Number(supersetSlot) : undefined,
          goal,
          targetSets,
          targetRepMin: targetRepMin ? Number(targetRepMin) : undefined,
          targetRepMax: targetRepMax ? Number(targetRepMax) : undefined,
        },
      }),
    onSuccess: () => {
      invalidateRoutine();
      setShowAddForm(false);
      setExerciseId("");
      setSupersetSlot("");
      setTargetRepMin("");
      setTargetRepMax("");
    },
    onError: (mutationError: unknown) => {
      setAddError(mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado");
    },
  });

  const removeExercise = useMutation({
    mutationFn: (routineExerciseId: string) =>
      apiFetch(`/routines/${id}/exercises/${routineExerciseId}`, { method: "DELETE", token }),
    onSuccess: () => invalidateRoutine(),
  });

  const startSession = useMutation({
    mutationFn: () => apiFetch<Session>("/sessions", { method: "POST", token, body: { routineId: id } }),
    onSuccess: (session) => navigate(`/sessions/${session.id}`),
  });

  function handleAddSubmit(event: FormEvent) {
    event.preventDefault();
    setAddError(null);
    if (!exerciseId) return;
    addExercise.mutate();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-neutral-950 px-4 py-8 text-neutral-100">
      <Link to="/routines" className="text-sm text-neutral-400 underline">
        ← Volver a rutinas
      </Link>

      {isLoading && <p className="text-neutral-400">Cargando...</p>}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          No se pudo cargar la rutina.
        </p>
      )}

      {routine && (
        <>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold">{routine.name}</h1>
            <Button onClick={() => startSession.mutate()} disabled={startSession.isPending}>
              Iniciar sesión
            </Button>
          </div>

          {routine.exercises.length === 0 ? (
            <p className="text-neutral-400">Esta rutina todavía no tiene ejercicios.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {groupByOrder(routine.exercises).map((group) => (
                <li key={group[0]!.id} className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3">
                  <ul className="flex flex-col gap-2">
                    {group.map((routineExercise) => (
                      <li key={routineExercise.id} className="flex items-start justify-between gap-2">
                        <span>
                          <span className="font-medium">
                            {routineExercise.supersetSlot !== null ? `A${routineExercise.supersetSlot} ` : ""}
                            {routineExercise.exercise.name}
                          </span>
                          <span className="block text-sm text-neutral-400">
                            {routineExercise.targetSets} series x {routineExercise.targetRepMin}-
                            {routineExercise.targetRepMax} reps · {GOAL_LABELS[routineExercise.goal]}
                          </span>
                        </span>
                        <Button
                          variant="danger"
                          className="shrink-0 px-2 py-1 text-xs"
                          onClick={() => removeExercise.mutate(routineExercise.id)}
                        >
                          Quitar
                        </Button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          {showAddForm ? (
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3">
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
                  Orden
                  <Input type="number" min={1} value={order} onChange={(event) => setOrder(Number(event.target.value))} />
                </FieldLabel>
                <FieldLabel>
                  Superserie (opcional)
                  <Input
                    type="number"
                    min={1}
                    placeholder="1, 2..."
                    value={supersetSlot}
                    onChange={(event) => setSupersetSlot(event.target.value)}
                  />
                </FieldLabel>
              </div>
              <FieldLabel>
                Objetivo
                <Select value={goal} onChange={(event) => setGoal(event.target.value as TrainingGoal)}>
                  <option value="STRENGTH">Fuerza</option>
                  <option value="HYPERTROPHY">Hipertrofia</option>
                  <option value="ENDURANCE">Resistencia</option>
                </Select>
              </FieldLabel>
              <FieldLabel>
                Series
                <Input
                  type="number"
                  min={1}
                  value={targetSets}
                  onChange={(event) => setTargetSets(Number(event.target.value))}
                />
              </FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <FieldLabel>
                  Reps min
                  <Input type="number" value={targetRepMin} onChange={(event) => setTargetRepMin(event.target.value)} />
                </FieldLabel>
                <FieldLabel>
                  Reps max
                  <Input type="number" value={targetRepMax} onChange={(event) => setTargetRepMax(event.target.value)} />
                </FieldLabel>
              </div>
              <Button type="button" variant="secondary" onClick={fillSuggestion} disabled={!selectedExercise}>
                Usar sugerencia
              </Button>
              {addError && (
                <p role="alert" className="text-sm text-red-400">
                  {addError}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={addExercise.isPending}>
                  Agregar
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="secondary" onClick={() => setShowAddForm(true)}>
              Agregar ejercicio
            </Button>
          )}
        </>
      )}
    </main>
  );
}
