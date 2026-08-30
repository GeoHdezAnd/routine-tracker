import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Search, X } from "lucide-react";
import type { MovementType } from "@routine-tracker/shared";
import { ROUTINE_COLORS } from "@routine-tracker/shared";
import type { RoutineColor } from "@routine-tracker/shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { colorForKey, colorForLabel } from "../../lib/colors";
import { DAY_ORDER, DAY_LABELS } from "../../lib/days";
import { Input, Pill } from "../../components/ui";

type Exercise = { id: string; name: string; muscleGroup: string; movementType: MovementType };
type ExercisesResponse = { data: Exercise[] };
type Routine = { id: string };

export function CreateRoutineModal({ onClose, onCreated }: { onClose: () => void; onCreated: (routineId: string) => void }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [color, setColor] = useState<RoutineColor>(ROUTINE_COLORS[0]);
  const [days, setDays] = useState<string[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  const { data: exercisesData } = useQuery({
    queryKey: ["exercises-for-new-routine", token],
    queryFn: () => apiFetch<ExercisesResponse>("/exercises?limit=100", { token }),
  });

  const { data: availableMuscleGroups } = useQuery({
    queryKey: ["muscle-groups", token],
    queryFn: () => apiFetch<string[]>("/exercises/muscle-groups", { token }),
  });

  const filteredExercises = (exercisesData?.data ?? []).filter(
    (exercise) =>
      exercise.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (muscleGroups.length === 0 || muscleGroups.includes(exercise.muscleGroup)),
  );

  function toggleDay(day: string) {
    setDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day]));
  }

  function toggleMuscleGroup(group: string) {
    setMuscleGroups((current) =>
      current.includes(group) ? current.filter((value) => value !== group) : [...current, group],
    );
  }

  function toggleExercise(exerciseId: string) {
    setSelectedExerciseIds((current) =>
      current.includes(exerciseId) ? current.filter((value) => value !== exerciseId) : [...current, exerciseId],
    );
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
    setError(null);
    if (!name.trim()) return;
    createRoutine.mutate();
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-60 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="animate-sheet-in flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-surface sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-2xl font-bold">Nueva rutina</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-fg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-3">
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

            {availableMuscleGroups && availableMuscleGroups.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Grupos musculares</h3>
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

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                Ejercicios {selectedExerciseIds.length > 0 && `(${selectedExerciseIds.length} seleccionados)`}
              </h3>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
                <Input
                  placeholder="Buscar ejercicios..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
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
                      <span className="min-w-0 flex-1 truncate font-medium">{exercise.name}</span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${muscleColor.soft} ${muscleColor.fg}`}
                      >
                        {exercise.muscleGroup}
                      </span>
                    </button>
                  );
                })}
                {filteredExercises.length === 0 && (
                  <p className="px-3 py-4 text-sm text-fg-muted">No se encontraron ejercicios.</p>
                )}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-2 px-5 pt-3 pb-5">
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={!name.trim() || createRoutine.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-base font-bold text-accent-fg transition-opacity disabled:opacity-50"
            >
              {createRoutine.isPending && <Loader2 className="size-4 animate-spin" />}
              Crear rutina
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
