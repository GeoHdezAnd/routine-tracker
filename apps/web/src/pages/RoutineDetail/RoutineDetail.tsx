import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MovementType, TrainingGoal } from "@routine-tracker/shared";
import { ChevronLeft, Dumbbell, Loader2, Pencil, Plus, Trash2, Wand2, X, Zap } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { colorForLabel, colorForRoutine } from "../../lib/colors";
import { DAY_ORDER, DAY_LABELS, sortDays } from "../../lib/days";
import { Button, Card, FieldLabel, IconButton, Input, Menu, Pill, Select } from "../../components/ui";

type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
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
  color: string | null;
  muscleGroups: string[];
  trainingDays: string[];
  isInPlan: boolean;
  exercises: RoutineExercise[];
};

type Session = { id: string };

const GOAL_LABELS: Record<TrainingGoal, string> = {
  STRENGTH: "Fuerza",
  HYPERTROPHY: "Hipertrofia",
  ENDURANCE: "Resistencia",
};

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

  const [isEditingDays, setIsEditingDays] = useState(false);
  const [editDays, setEditDays] = useState<string[]>([]);
  const [daysError, setDaysError] = useState<string | null>(null);

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

  const togglePlan = useMutation({
    mutationFn: (nextInPlan: boolean) =>
      apiFetch(`/routines/${id}/plan`, { method: nextInPlan ? "POST" : "DELETE", token }),
    onSuccess: () => {
      invalidateRoutine();
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

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

  const updateTrainingDays = useMutation({
    mutationFn: () =>
      apiFetch(`/routines/${id}`, {
        method: "PATCH",
        token,
        body: { trainingDays: editDays },
      }),
    onSuccess: () => {
      setIsEditingDays(false);
      invalidateRoutine();
    },
    onError: (mutationError: unknown) => {
      setDaysError(mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado");
    },
  });

  function startEditingDays(current: string[]) {
    setEditDays(current);
    setDaysError(null);
    setIsEditingDays(true);
  }

  function toggleDay(day: string) {
    setEditDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day]));
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

  const heroColor = routine ? colorForRoutine(routine) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-3 bg-canvas px-4 pt-4 pb-24 text-fg">
      <Link to="/routines" className="flex items-center gap-0.5 text-sm font-medium text-accent">
        <ChevronLeft className="size-4" />
        Rutinas
      </Link>

      {isLoading && <p className="text-fg-muted">Cargando...</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          No se pudo cargar la rutina.
        </p>
      )}

      {routine && heroColor && (
        <>
          <div className="flex items-start gap-4">
            <span
              className={`flex size-20 shrink-0 items-center justify-center rounded-2xl ${heroColor.dot}`}
            >
              <Dumbbell className="size-9 text-white" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              {isEditingName ? (
                <form onSubmit={handleNameSubmit} className="flex flex-col gap-2">
                  <Input value={editName} onChange={(event) => setEditName(event.target.value)} autoFocus />
                  {nameError && (
                    <p role="alert" className="text-sm text-danger">
                      {nameError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" className="px-3 py-1 text-sm" disabled={updateName.isPending} loading={updateName.isPending}>
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
                <div className="flex items-center gap-1">
                  <h1 className="truncate text-2xl leading-tight font-black">{routine.name}</h1>
                  <IconButton
                    aria-label="Editar nombre"
                    className="size-7 shrink-0"
                    onClick={() => startEditingName(routine.name)}
                  >
                    <Pencil className="size-3.5" />
                  </IconButton>
                </div>
              )}
              <p className="mt-0.5 truncate text-fg-muted">
                {routine.exercises.length} ejercicio{routine.exercises.length === 1 ? "" : "s"}
                {routine.trainingDays.length > 0 &&
                  ` · ${sortDays(routine.trainingDays)
                    .map((day) => DAY_LABELS[day as (typeof DAY_ORDER)[number]])
                    .join(", ")}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-fg-muted">
            <span>
              {routine.muscleGroups.length > 0
                ? routine.muscleGroups.join(", ")
                : "Sin grupos musculares asignados"}
            </span>
            <button
              type="button"
              onClick={() => startEditingMuscleGroups(routine.muscleGroups)}
              className="ml-1 font-medium text-accent"
            >
              Editar
            </button>
            <span className="px-1 text-fg-subtle">·</span>
            <span>Días de entreno</span>
            <button
              type="button"
              onClick={() => startEditingDays(routine.trainingDays)}
              className="font-medium text-accent"
            >
              Editar
            </button>
          </div>

          <Pill
            active={routine.isInPlan}
            disabled={togglePlan.isPending}
            onClick={() => togglePlan.mutate(!routine.isInPlan)}
            className="self-start"
          >
            {routine.isInPlan ? "En tu plan actual" : "Agregar a tu plan"}
          </Pill>

          {isEditingMuscleGroups && (
            <Card>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setMuscleGroupsError(null);
                  updateMuscleGroups.mutate();
                }}
                className="flex flex-col gap-3"
              >
                <p className="text-sm font-semibold">Grupos musculares</p>
                <div className="flex flex-wrap gap-2">
                  {availableMuscleGroups?.map((group) => (
                    <Pill
                      key={group}
                      type="button"
                      active={editMuscleGroups.includes(group)}
                      onClick={() => toggleMuscleGroup(group)}
                    >
                      {group}
                    </Pill>
                  ))}
                </div>
                {muscleGroupsError && (
                  <p role="alert" className="text-sm text-danger">
                    {muscleGroupsError}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" className="px-3 py-1 text-sm" disabled={updateMuscleGroups.isPending} loading={updateMuscleGroups.isPending}>
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
            </Card>
          )}

          {isEditingDays && (
            <Card>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setDaysError(null);
                  updateTrainingDays.mutate();
                }}
                className="flex flex-col gap-3"
              >
                <p className="text-sm font-semibold">Días de entreno</p>
                <div className="flex flex-wrap gap-2">
                  {DAY_ORDER.map((day) => (
                    <Pill key={day} type="button" active={editDays.includes(day)} onClick={() => toggleDay(day)}>
                      {DAY_LABELS[day]}
                    </Pill>
                  ))}
                </div>
                {daysError && (
                  <p role="alert" className="text-sm text-danger">
                    {daysError}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" className="px-3 py-1 text-sm" disabled={updateTrainingDays.isPending} loading={updateTrainingDays.isPending}>
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3 py-1 text-sm"
                    onClick={() => setIsEditingDays(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <button
            type="button"
            onClick={() => startSession.mutate()}
            disabled={startSession.isPending || routine.exercises.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-lg font-bold text-accent-fg transition-opacity disabled:opacity-50"
          >
            {startSession.isPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Zap className="size-5" fill="currentColor" />
            )}
            Iniciar entrenamiento
          </button>

          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Ejercicios</h2>
            <IconButton
              aria-label={showAddForm ? "Cerrar formulario" : "Agregar ejercicio"}
              className="size-8"
              onClick={() => setShowAddForm((current) => !current)}
            >
              {showAddForm ? <X className="size-5" /> : <Plus className="size-5" />}
            </IconButton>
          </div>

          {showAddForm && (
            <Card>
              <form onSubmit={handleAddSubmit} className="flex flex-col gap-3">
                <p className="text-sm font-semibold">Agregar ejercicio</p>
                <FieldLabel>
                  Ejercicio
                  <Select value={exerciseId} onChange={setExerciseId}>
                    <option value="">Elige un ejercicio</option>
                    {exercisesData?.data.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.name}
                      </option>
                    ))}
                  </Select>
                </FieldLabel>
                {routine.muscleGroups.length > 0 && (
                  <label className="flex items-center gap-1 text-sm text-fg-muted">
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
                  <Select value={goal} onChange={(value) => setGoal(value as TrainingGoal)}>
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
                  className="flex items-center justify-center gap-2"
                >
                  {repRangeSuggestion.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wand2 className="size-4" />
                  )}
                  Usar sugerencia
                </Button>
                {addError && (
                  <p role="alert" className="text-sm text-danger">
                    {addError}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={addExercise.isPending} loading={addExercise.isPending}>
                    Agregar
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {routine.exercises.length === 0 ? (
            <p className="text-fg-muted">
              Esta rutina todavía no tiene ejercicios. Agrega al menos uno para poder iniciar una sesión.
            </p>
          ) : (
            <Card className="divide-y divide-border overflow-hidden p-0">
              {routine.exercises.map((routineExercise) => {
                const color = colorForLabel(routineExercise.exercise.muscleGroup);
                return editingId === routineExercise.id ? (
                  <div key={routineExercise.id} className="flex flex-col gap-2 bg-surface-muted px-4 py-3">
                    <form
                      className="flex flex-col gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        updateExercise.mutate(routineExercise.id);
                      }}
                    >
                      <p className="truncate text-sm font-semibold">Editando: {routineExercise.exercise.name}</p>
                      <FieldLabel>
                        Objetivo
                        <Select
                          value={editGoal}
                          onChange={(value) => setEditGoal(value as TrainingGoal)}
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
                        className="flex items-center justify-center gap-2"
                        onClick={() => editRepRangeSuggestion.mutate(routineExercise.exercise.movementType)}
                        disabled={editRepRangeSuggestion.isPending}
                      >
                        {editRepRangeSuggestion.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Wand2 className="size-4" />
                        )}
                        Usar sugerencia
                      </Button>
                      {editError && (
                        <p role="alert" className="text-sm text-danger">
                          {editError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button type="submit" className="px-3 py-1 text-sm" disabled={updateExercise.isPending} loading={updateExercise.isPending}>
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
                  </div>
                ) : (
                  <div key={routineExercise.id} className="flex items-center gap-3 px-2 py-3">
                    <span className={`size-2.5 shrink-0 rounded-full ${color.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {routineExercise.supersetSlot !== null && (
                          <span className="mr-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-xs font-bold text-accent">
                            A{routineExercise.supersetSlot}
                          </span>
                        )}
                        {routineExercise.exercise.name}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <p className="min-w-0 flex-1 truncate text-xs text-fg-muted">
                          {routineExercise.targetSets} series x {routineExercise.targetRepMin}-
                          {routineExercise.targetRepMax} reps · {GOAL_LABELS[routineExercise.goal]}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${color.soft} ${color.fg}`}
                        >
                          {routineExercise.exercise.muscleGroup}
                        </span>
                      </div>
                    </div>
                    <Menu
                      items={[
                        { label: "Editar", icon: <Pencil className="size-4" />, onClick: () => startEditing(routineExercise) },
                        {
                          label: "Quitar",
                          icon:
                            removeExercise.isPending && removeExercise.variables === routineExercise.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            ),
                          variant: "danger",
                          disabled: removeExercise.isPending,
                          onClick: () => removeExercise.mutate(routineExercise.id),
                        },
                      ]}
                    />
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}
    </main>
  );
}
