import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronLeft, Loader2, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { MovementType } from "@routine-tracker/shared";
import { ROUTINE_COLORS } from "@routine-tracker/shared";
import type { RoutineColor } from "@routine-tracker/shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { colorForKey, colorForLabel } from "../../lib/colors";
import { DAY_ORDER, DAY_LABELS } from "../../lib/days";
import { useLockBodyScroll } from "../../lib/useLockBodyScroll";
import { CreateExerciseForm } from "../../components/CreateExerciseForm";
import { ExerciseThumbnail } from "../../components/ExerciseThumbnail";
import { Input, Pill } from "../../components/ui";

type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipmentType: string;
  movementType: MovementType;
  imageUrl?: string | null;
};
type ExercisesResponse = { data: Exercise[] };
type Routine = { id: string };

type Step = "details" | "exercises";

export function CreateRoutineModal({ onClose, onCreated }: { onClose: () => void; onCreated: (routineId: string) => void }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("details");

  const [name, setName] = useState("");
  const [color, setColor] = useState<RoutineColor>(ROUTINE_COLORS[0]);
  const [days, setDays] = useState<string[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useLockBodyScroll();

  const { data: exercisesData } = useQuery({
    queryKey: ["exercises-for-new-routine", token],
    queryFn: () => apiFetch<ExercisesResponse>("/exercises?limit=100", { token }),
  });

  const { data: availableMuscleGroups } = useQuery({
    queryKey: ["muscle-groups", token],
    queryFn: () => apiFetch<string[]>("/exercises/muscle-groups", { token }),
  });

  const availableEquipmentTypes = useMemo(() => {
    const exercises = exercisesData?.data ?? [];
    const relevant =
      muscleGroups.length === 0 ? exercises : exercises.filter((exercise) => muscleGroups.includes(exercise.muscleGroup));
    return Array.from(new Set(relevant.map((exercise) => exercise.equipmentType))).sort();
  }, [exercisesData, muscleGroups]);

  useEffect(() => {
    setEquipmentTypes((current) => {
      const next = current.filter((type) => availableEquipmentTypes.includes(type));
      return next.length === current.length ? current : next;
    });
  }, [availableEquipmentTypes]);

  const activeFilterCount = muscleGroups.length + equipmentTypes.length;

  const filteredExercises = (exercisesData?.data ?? []).filter(
    (exercise) =>
      exercise.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (muscleGroups.length === 0 || muscleGroups.includes(exercise.muscleGroup)) &&
      (equipmentTypes.length === 0 || equipmentTypes.includes(exercise.equipmentType)),
  );

  function toggleDay(day: string) {
    setDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day]));
  }

  function toggleMuscleGroup(group: string) {
    setMuscleGroups((current) =>
      current.includes(group) ? current.filter((value) => value !== group) : [...current, group],
    );
  }

  function toggleEquipmentType(type: string) {
    setEquipmentTypes((current) =>
      current.includes(type) ? current.filter((value) => value !== type) : [...current, type],
    );
  }

  function toggleExercise(exerciseId: string) {
    setSelectedExerciseIds((current) =>
      current.includes(exerciseId) ? current.filter((value) => value !== exerciseId) : [...current, exerciseId],
    );
  }

  function handleExerciseCreated(exercise: Exercise) {
    setSelectedExerciseIds((current) => [...current, exercise.id]);
    setShowCreateForm(false);
  }

  const createRoutine = useMutation({
    mutationFn: async () => {
      const routine = await apiFetch<Routine>("/routines", {
        method: "POST",
        token,
        body: { name: name.trim(), color, trainingDays: days, muscleGroups },
      });

      await Promise.all(
        selectedExerciseIds.map((exerciseId, index) =>
          apiFetch(`/routines/${routine.id}/exercises`, {
            method: "POST",
            token,
            body: { exerciseId, order: index + 1, goal: "HYPERTROPHY", targetSets: 3 },
          }),
        ),
      );

      return routine;
    },
    onSuccess: (routine) => {
      void queryClient.invalidateQueries({ queryKey: ["routines", token] });
      onCreated(routine.id);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === "details") {
      if (!name.trim()) return;
      setStep("exercises");
      return;
    }
    setError(null);
    createRoutine.mutate();
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-60 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="animate-sheet-in flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-surface sm:rounded-3xl">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          {step === "exercises" && (
            <button
              type="button"
              aria-label="Atrás"
              onClick={() => setStep("details")}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <h2 className="flex-1 text-2xl font-bold">
            {step === "details" ? "Nueva rutina" : "Elegir ejercicios"}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {step === "details" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-3 mt-2">
              <Input
                placeholder="Nombre de la rutina..."
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />

              <div className="flex gap-2">
                {ROUTINE_COLORS.map((key) => {
                  const swatch = colorForKey(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={`Color ${key}`}
                      aria-pressed={color === key}
                      onClick={() => setColor(key)}
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full ${swatch.dot} ${
                        color === key ? "ring-2 ring-fg ring-offset-2 ring-offset-surface" : ""
                      }`}
                    >
                      {color === key && <Check className="size-4 text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>

              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Horario</h3>
                <div className="flex flex-wrap gap-2">
                  {DAY_ORDER.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        days.includes(day) ? "bg-accent text-accent-fg" : "bg-surface-muted text-fg-muted"
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-3">
              <div className="relative shrink-0">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
                <Input
                  placeholder="Buscar ejercicios..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                />
              </div>

              {((availableMuscleGroups && availableMuscleGroups.length > 0) || availableEquipmentTypes.length > 0) && (
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFilters((current) => !current)}
                    className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-sm font-medium text-fg"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="size-4" />
                      Filtros
                      {activeFilterCount > 0 && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-fg">
                          {activeFilterCount}
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      className={`size-4 text-fg-subtle transition-transform ${showFilters ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showFilters && (
                    <div className="mt-3 flex max-h-40 flex-col gap-3 overflow-y-auto">
                      {availableMuscleGroups && availableMuscleGroups.length > 0 && (
                        <section className="flex flex-col gap-2">
                          <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                            Grupos musculares
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {availableMuscleGroups.map((group) => (
                              <Pill
                                key={group}
                                active={muscleGroups.includes(group)}
                                onClick={() => toggleMuscleGroup(group)}
                              >
                                {group}
                              </Pill>
                            ))}
                          </div>
                        </section>
                      )}

                      {availableEquipmentTypes.length > 0 && (
                        <section className="flex flex-col gap-2">
                          <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Aparatos</h3>
                          <div className="flex flex-wrap gap-2">
                            {availableEquipmentTypes.map((type) => (
                              <Pill
                                key={type}
                                active={equipmentTypes.includes(type)}
                                onClick={() => toggleEquipmentType(type)}
                              >
                                {type}
                              </Pill>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </div>
              )}

              <h3 className="shrink-0 text-xs font-semibold tracking-wide text-fg-muted uppercase">
                Ejercicios {selectedExerciseIds.length > 0 && `(${selectedExerciseIds.length} seleccionados)`}
              </h3>

              {showCreateForm ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <CreateExerciseForm
                    initialName={search}
                    onCancel={() => setShowCreateForm(false)}
                    onCreated={handleExerciseCreated}
                  />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                  <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                    {filteredExercises.map((exercise) => {
                      const checked = selectedExerciseIds.includes(exercise.id);
                      const muscleColor = colorForLabel(exercise.muscleGroup);
                      return (
                        <button
                          key={exercise.id}
                          type="button"
                          onClick={() => toggleExercise(exercise.id)}
                          className="flex items-center gap-3 px-3 py-2.5 text-left"
                        >
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                              checked ? "border-accent bg-accent" : "border-border"
                            }`}
                          >
                            {checked && <Check className="size-3 text-accent-fg" strokeWidth={3} />}
                          </span>
                          <ExerciseThumbnail imageUrl={exercise.imageUrl} size="size-8" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{exercise.name}</span>
                            <span className="flex flex-wrap items-center gap-1">
                              <span
                                className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${muscleColor.soft} ${muscleColor.fg}`}
                              >
                                {exercise.muscleGroup}
                              </span>
                              <span className="mt-0.5 inline-block rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-fg-muted">
                                {exercise.equipmentType}
                              </span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                    {filteredExercises.length === 0 && (
                      <p className="px-3 py-4 text-sm text-fg-muted">No se encontraron ejercicios.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-accent"
                  >
                    <Plus className="size-4" />
                    Crear ejercicio nuevo
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 px-5 pt-3 pb-5">
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            {step === "details" ? (
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-base font-bold text-accent-fg transition-opacity disabled:opacity-50"
              >
                Siguiente
              </button>
            ) : (
              <button
                type="submit"
                disabled={createRoutine.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-base font-bold text-accent-fg transition-opacity disabled:opacity-50"
              >
                {createRoutine.isPending && <Loader2 className="size-4 animate-spin" />}
                Crear rutina
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
