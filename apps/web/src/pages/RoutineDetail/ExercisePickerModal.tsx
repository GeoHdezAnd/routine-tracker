import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { MovementType } from "@routine-tracker/shared";
import { colorForLabel } from "../../lib/colors";
import { useLockBodyScroll } from "../../lib/useLockBodyScroll";
import { CreateExerciseForm } from "../../components/CreateExerciseForm";
import { Input, Pill } from "../../components/ui";

type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipmentType?: string;
  movementType: MovementType;
};

export function ExercisePickerModal({
  exercises,
  selectedId,
  onSelect,
  onClose,
}: {
  exercises: Exercise[];
  selectedId: string | null;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  useLockBodyScroll();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>([]);

  const activeFilterCount = muscleGroups.length + equipmentTypes.length;

  const availableMuscleGroups = useMemo(
    () => Array.from(new Set(exercises.map((exercise) => exercise.muscleGroup))).sort(),
    [exercises],
  );

  const availableEquipmentTypes = useMemo(() => {
    const relevant =
      muscleGroups.length === 0 ? exercises : exercises.filter((exercise) => muscleGroups.includes(exercise.muscleGroup));
    return Array.from(new Set(relevant.map((exercise) => exercise.equipmentType).filter((value): value is string => Boolean(value)))).sort();
  }, [exercises, muscleGroups]);

  useEffect(() => {
    setEquipmentTypes((current) => {
      const next = current.filter((type) => availableEquipmentTypes.includes(type));
      return next.length === current.length ? current : next;
    });
  }, [availableEquipmentTypes]);

  const filteredExercises = exercises.filter(
    (exercise) =>
      exercise.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (muscleGroups.length === 0 || muscleGroups.includes(exercise.muscleGroup)) &&
      (equipmentTypes.length === 0 || (exercise.equipmentType && equipmentTypes.includes(exercise.equipmentType))),
  );

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

  return (
    <div className="animate-fade-in fixed inset-0 z-60 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="animate-sheet-in flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-surface sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-2xl font-bold">Elegir ejercicio</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-fg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5">
          <div className="relative shrink-0">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              placeholder="Buscar ejercicios..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {(availableMuscleGroups.length > 0 || availableEquipmentTypes.length > 0) && (
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
                  {availableMuscleGroups.length > 0 && (
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

          {showCreateForm ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CreateExerciseForm
                initialName={search}
                onCancel={() => setShowCreateForm(false)}
                onCreated={(exercise) => onSelect(exercise)}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {filteredExercises.map((exercise) => {
                  const checked = exercise.id === selectedId;
                  const muscleColor = colorForLabel(exercise.muscleGroup);
                  return (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => onSelect(exercise)}
                      className="flex items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          checked ? "border-accent bg-accent" : "border-border"
                        }`}
                      >
                        {checked && <Check className="size-3 text-accent-fg" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{exercise.name}</span>
                        <span className="flex flex-wrap items-center gap-1">
                          <span
                            className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${muscleColor.soft} ${muscleColor.fg}`}
                          >
                            {exercise.muscleGroup}
                          </span>
                          {exercise.equipmentType && (
                            <span className="mt-0.5 inline-block rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-fg-muted">
                              {exercise.equipmentType}
                            </span>
                          )}
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
      </div>
    </div>
  );
}
