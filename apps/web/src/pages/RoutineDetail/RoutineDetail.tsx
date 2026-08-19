import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MovementType, TrainingGoal } from "@routine-tracker/shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { Button, FieldLabel, Input, Select } from "../../components/ui";

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
  muscleGroups: string[];
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGoal, setEditGoal] = useState<TrainingGoal>("HYPERTROPHY");
  const [editTargetSets, setEditTargetSets] = useState(3);
  const [editTargetRepMin, setEditTargetRepMin] = useState("");
  const [editTargetRepMax, setEditTargetRepMax] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const [isEditingMuscleGroups, setIsEditingMuscleGroups] = useState(false);
  const [editMuscleGroups, setEditMuscleGroups] = useState<string[]>([]);
  const [muscleGroupsError, setMuscleGroupsError] = useState<string | null>(null);
  const [viewAllExercises, setViewAllExercises] = useState(false);

  const {
    data: routine,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["routine", id, token],
    queryFn: () => apiFetch<RoutineDetail>(`/routines/${id}`, { token }),
    enabled: id !== undefined,
  });

  const filterByMuscleGroups =
    !viewAllExercises && (routine?.muscleGroups.length ?? 0) > 0 ? routine!.muscleGroups : null;

  const { data: exercisesData } = useQuery({
    queryKey: ["exercises-for-routine", token, filterByMuscleGroups],
    queryFn: () => {
      const query = filterByMuscleGroups
        ? `?muscleGroup=${filterByMuscleGroups.map(encodeURIComponent).join(",")}&limit=100`
        : "?limit=100";
      return apiFetch<ExercisesResponse>(`/exercises${query}`, { token });
    },
    enabled: showAddForm,
  });

  const { data: availableMuscleGroups } = useQuery({
    queryKey: ["muscle-groups", token],
    queryFn: () => apiFetch<string[]>("/exercises/muscle-groups", { token }),
    enabled: isEditingMuscleGroups,
  });

  function invalidateRoutine() {
    void queryClient.invalidateQueries({ queryKey: ["routine", id] });
  }

  const selectedExercise = exercisesData?.data.find((exercise) => exercise.id === exerciseId);

  const repRangeSuggestion = useMutation({
    mutationFn: () =>
      apiFetch<{ targetRepMin: number; targetRepMax: number }>(
        `/routines/rep-range-suggestion?movementType=${selectedExercise?.movementType}&goal=${goal}`,
        { token },
      ),
    onSuccess: (suggestion) => {
      setTargetRepMin(String(suggestion.targetRepMin));
      setTargetRepMax(String(suggestion.targetRepMax));
    },
    onError: (mutationError: unknown) => {
      setAddError(
        mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado",
      );
    },
  });

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
      setAddError(
        mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado",
      );
    },
  });

  const removeExercise = useMutation({
    mutationFn: (routineExerciseId: string) =>
      apiFetch(`/routines/${id}/exercises/${routineExerciseId}`, { method: "DELETE", token }),
    onSuccess: () => invalidateRoutine(),
  });

  const updateExercise = useMutation({
    mutationFn: (routineExerciseId: string) =>
      apiFetch(`/routines/${id}/exercises/${routineExerciseId}`, {
        method: "PATCH",
        token,
        body: {
          goal: editGoal,
          targetSets: editTargetSets,
          targetRepMin: Number(editTargetRepMin),
          targetRepMax: Number(editTargetRepMax),
        },
      }),
    onSuccess: () => {
      setEditingId(null);
      invalidateRoutine();
    },
    onError: (mutationError: unknown) => {
      setEditError(
        mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado",
      );
    },
  });

  const updateName = useMutation({
    mutationFn: () =>
      apiFetch(`/routines/${id}`, {
        method: "PATCH",
        token,
        body: { name: editName.trim() },
      }),
    onSuccess: () => {
      setIsEditingName(false);
      invalidateRoutine();
    },
    onError: (mutationError: unknown) => {
      setNameError(
        mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado",
      );
    },
  });

  function startEditingName(currentName: string) {
    setEditName(currentName);
    setNameError(null);
    setIsEditingName(true);
  }

  function handleNameSubmit(event: FormEvent) {
    event.preventDefault();
    setNameError(null);
    if (!editName.trim()) return;
    updateName.mutate();
  }

  const updateMuscleGroups = useMutation({
    mutationFn: () =>
      apiFetch(`/routines/${id}`, {
        method: "PATCH",
        token,
        body: { muscleGroups: editMuscleGroups },
      }),
    onSuccess: () => {
      setIsEditingMuscleGroups(false);
      invalidateRoutine();
    },
    onError: (mutationError: unknown) => {
      setMuscleGroupsError(
        mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado",
      );
    },
  });

  function startEditingMuscleGroups(current: string[]) {
    setEditMuscleGroups(current);
    setMuscleGroupsError(null);
    setIsEditingMuscleGroups(true);
  }

  function toggleMuscleGroup(group: string) {
    setEditMuscleGroups((current) =>
      current.includes(group) ? current.filter((value) => value !== group) : [...current, group],
    );
  }

  function startEditing(routineExercise: RoutineExercise) {
    setEditingId(routineExercise.id);
    setEditGoal(routineExercise.goal);
    setEditTargetSets(routineExercise.targetSets);
    setEditTargetRepMin(String(routineExercise.targetRepMin));
    setEditTargetRepMax(String(routineExercise.targetRepMax));
    setEditError(null);
  }

  const editRepRangeSuggestion = useMutation({
    mutationFn: (movementType: MovementType) =>
      apiFetch<{ targetRepMin: number; targetRepMax: number }>(
        `/routines/rep-range-suggestion?movementType=${movementType}&goal=${editGoal}`,
        { token },
      ),
    onSuccess: (suggestion) => {
      setEditTargetRepMin(String(suggestion.targetRepMin));
      setEditTargetRepMax(String(suggestion.targetRepMax));
    },
    onError: (mutationError: unknown) => {
      setEditError(
        mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado",
      );
    },
  });

  const startSession = useMutation({
    mutationFn: () =>
      apiFetch<Session>("/sessions", { method: "POST", token, body: { routineId: id } }),
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
          {isEditingName ? (
            <form onSubmit={handleNameSubmit} className="flex flex-col gap-2">
              <Input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                autoFocus
              />
              {nameError && (
                <p role="alert" className="text-sm text-red-400">
                  {nameError}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" className="px-3 py-1 text-sm" disabled={updateName.isPending}>
                  Guardar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-3 py-1 text-sm"
                  onClick={() => setIsEditingName(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{routine.name}</h1>
                <button
                  type="button"
                  onClick={() => startEditingName(routine.name)}
                  className="text-sm text-neutral-400 underline"
                >
                  Editar
                </button>
              </div>
              <Button
                onClick={() => startSession.mutate()}
                disabled={startSession.isPending || routine.exercises.length === 0}
              >
                Iniciar sesión
              </Button>
            </div>
          )}

          {isEditingMuscleGroups ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setMuscleGroupsError(null);
                updateMuscleGroups.mutate();
              }}
              className="flex flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3"
            >
              <p className="text-sm font-medium">Grupos musculares</p>
              <div className="flex flex-wrap gap-2">
                {availableMuscleGroups?.map((group) => (
                  <label key={group} className="flex items-center gap-1 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      checked={editMuscleGroups.includes(group)}
                      onChange={() => toggleMuscleGroup(group)}
                    />
                    {group}
                  </label>
                ))}
              </div>
              {muscleGroupsError && (
                <p role="alert" className="text-sm text-red-400">
                  {muscleGroupsError}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" className="px-3 py-1 text-sm" disabled={updateMuscleGroups.isPending}>
                  Guardar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-3 py-1 text-sm"
                  onClick={() => setIsEditingMuscleGroups(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <span>
                {routine.muscleGroups.length > 0
                  ? routine.muscleGroups.join(", ")
                  : "Sin grupos musculares asignados"}
              </span>
              <button
                type="button"
                onClick={() => startEditingMuscleGroups(routine.muscleGroups)}
                className="underline"
              >
                Editar
              </button>
            </div>
          )}

          {routine.exercises.length === 0 ? (
            <p className="text-neutral-400">
              Esta rutina todavía no tiene ejercicios. Agregá al menos uno para poder iniciar una sesión.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {groupByOrder(routine.exercises).map((group) => (
                <li
                  key={group[0]!.id}
                  className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3"
                >
                  <ul className="flex flex-col gap-2">
                    {group.map((routineExercise) =>
                      editingId === routineExercise.id ? (
                        <li
                          key={routineExercise.id}
                          className="flex flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-3"
                        >
                          <form
                            className="flex flex-col gap-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              updateExercise.mutate(routineExercise.id);
                            }}
                          >
                            <FieldLabel>
                              Objetivo
                              <Select
                                value={editGoal}
                                onChange={(event) => setEditGoal(event.target.value as TrainingGoal)}
                              >
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
                                value={editTargetSets}
                                onChange={(event) => setEditTargetSets(Number(event.target.value))}
                              />
                            </FieldLabel>
                            <div className="grid grid-cols-2 gap-2">
                              <FieldLabel>
                                Reps min
                                <Input
                                  type="number"
                                  value={editTargetRepMin}
                                  onChange={(event) => setEditTargetRepMin(event.target.value)}
                                />
                              </FieldLabel>
                              <FieldLabel>
                                Reps max
                                <Input
                                  type="number"
                                  value={editTargetRepMax}
                                  onChange={(event) => setEditTargetRepMax(event.target.value)}
                                />
                              </FieldLabel>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              className="px-3 py-1 text-sm"
                              onClick={() => editRepRangeSuggestion.mutate(routineExercise.exercise.movementType)}
                              disabled={editRepRangeSuggestion.isPending}
                            >
                              Usar sugerencia
                            </Button>
                            {editError && (
                              <p role="alert" className="text-sm text-red-400">
                                {editError}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <Button
                                type="submit"
                                className="px-3 py-1 text-sm"
                                disabled={updateExercise.isPending}
                              >
                                Guardar
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                className="px-3 py-1 text-sm"
                                onClick={() => setEditingId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </form>
                        </li>
                      ) : (
                        <li
                          key={routineExercise.id}
                          className="flex items-start justify-between gap-2"
                        >
                          <span>
                            <span className="font-medium">
                              {routineExercise.supersetSlot !== null
                                ? `A${routineExercise.supersetSlot} `
                                : ""}
                              {routineExercise.exercise.name}
                            </span>
                            <span className="block text-sm text-neutral-400">
                              {routineExercise.targetSets} series x {routineExercise.targetRepMin}-
                              {routineExercise.targetRepMax} reps ·{" "}
                              {GOAL_LABELS[routineExercise.goal]}
                            </span>
                          </span>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              onClick={() => startEditing(routineExercise)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="danger"
                              className="px-2 py-1 text-xs"
                              onClick={() => removeExercise.mutate(routineExercise.id)}
                            >
                              Quitar
                            </Button>
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          {showAddForm ? (
            <form
              onSubmit={handleAddSubmit}
              className="flex flex-col gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3"
            >
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
              {routine.muscleGroups.length > 0 && (
                <label className="flex items-center gap-1 text-sm text-neutral-400">
                  <input
                    type="checkbox"
                    checked={viewAllExercises}
                    onChange={(event) => setViewAllExercises(event.target.checked)}
                  />
                  Ver todos los ejercicios (no solo {routine.muscleGroups.join(", ")})
                </label>
              )}
              <div className="grid grid-cols-2 gap-2">
                <FieldLabel>
                  Orden
                  <Input
                    type="number"
                    min={1}
                    value={order}
                    onChange={(event) => setOrder(Number(event.target.value))}
                  />
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
                <Select
                  value={goal}
                  onChange={(event) => setGoal(event.target.value as TrainingGoal)}
                >
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
                  <Input
                    type="number"
                    value={targetRepMin}
                    onChange={(event) => setTargetRepMin(event.target.value)}
                  />
                </FieldLabel>
                <FieldLabel>
                  Reps max
                  <Input
                    type="number"
                    value={targetRepMax}
                    onChange={(event) => setTargetRepMax(event.target.value)}
                  />
                </FieldLabel>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => repRangeSuggestion.mutate()}
                disabled={!selectedExercise || repRangeSuggestion.isPending}
              >
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
