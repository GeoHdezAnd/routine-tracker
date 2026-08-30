import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MovementType } from "@routine-tracker/shared";
import { ChevronRight, Dumbbell, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { colorForLabel } from "../../lib/colors";
import { kgToDisplay, unitLabel } from "../../lib/units";
import { Button, Card, FieldLabel, IconButton, Input, Menu, Pill, Select } from "../../components/ui";

type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipmentType: string;
  movementType: MovementType;
  ownerId: string | null;
  personalRecord: { weightKg: number; reps: number } | null;
};

type ExercisesResponse = {
  data: Exercise[];
  total: number;
  limit: number;
  offset: number;
};

const MOVEMENT_LABELS: Record<MovementType, string> = {
  COMPOUND: "Compuesto",
  ISOLATION: "Aislamiento",
};


export function ExercisesPage() {
  const { token, user } = useAuth();
  const unit = user?.unitPreference ?? "KG";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [movementType, setMovementType] = useState<MovementType | "">("");
  const [showFilters, setShowFilters] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [newMuscleGroup, setNewMuscleGroup] = useState("");
  const [newEquipmentType, setNewEquipmentType] = useState("");
  const [newMovementType, setNewMovementType] = useState<MovementType>("COMPOUND");
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const query = new URLSearchParams({ limit: "100" });
  if (movementType) query.set("movementType", movementType);

  const { data, isLoading, error } = useQuery({
    queryKey: ["exercises", token, movementType],
    queryFn: () => apiFetch<ExercisesResponse>(`/exercises?${query.toString()}`, { token }),
  });

  const muscleGroups = useMemo(
    () => Array.from(new Set(data?.data.map((exercise) => exercise.muscleGroup) ?? [])).sort(),
    [data],
  );

  const equipmentTypes = useMemo(
    () => Array.from(new Set(data?.data.map((exercise) => exercise.equipmentType) ?? [])).sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.data ?? []).filter((exercise) => {
      if (muscleGroup && exercise.muscleGroup !== muscleGroup) return false;
      if (equipmentType && exercise.equipmentType !== equipmentType) return false;
      if (term && !exercise.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [data, muscleGroup, equipmentType, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Exercise[]>();
    for (const exercise of filtered) {
      const list = groups.get(exercise.muscleGroup) ?? [];
      list.push(exercise);
      groups.set(exercise.muscleGroup, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["exercises"] });
  }

  const createExercise = useMutation({
    mutationFn: () =>
      apiFetch<Exercise>("/exercises", {
        method: "POST",
        token,
        body: {
          name: name.trim(),
          muscleGroup: newMuscleGroup.trim(),
          equipmentType: newEquipmentType.trim(),
          movementType: newMovementType,
        },
      }),
    onSuccess: () => {
      setName("");
      setNewMuscleGroup("");
      setNewEquipmentType("");
      setShowCreateForm(false);
      invalidate();
    },
    onError: (mutationError: unknown) => {
      setFormError(mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado");
    },
  });

  const updateExercise = useMutation({
    mutationFn: (id: string) => apiFetch<Exercise>(`/exercises/${id}`, { method: "PATCH", token, body: { name: editName.trim() } }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const deleteExercise = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/exercises/${id}`, { method: "DELETE", token }),
    onSuccess: () => invalidate(),
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!name.trim() || !newMuscleGroup.trim() || !newEquipmentType.trim()) return;
    createExercise.mutate();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 bg-canvas px-4 pt-4 pb-24 text-fg">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ejercicios</h1>
        <IconButton
          aria-label={showCreateForm ? "Cerrar formulario" : "Agregar ejercicio"}
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? <X className="size-6" /> : <Plus className="size-6" />}
        </IconButton>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          placeholder="Buscar ejercicios..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full pl-10"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Pill active={muscleGroup === ""} onClick={() => setMuscleGroup("")}>
          Todos
        </Pill>
        {muscleGroups.map((group) => (
          <Pill key={group} active={muscleGroup === group} onClick={() => setMuscleGroup(group)}>
            {group}
          </Pill>
        ))}
      </div>

      <details
        className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm"
        open={showFilters}
        onToggle={(event) => setShowFilters(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-medium text-fg-muted">Filtros avanzados</summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Select value={equipmentType} onChange={setEquipmentType}>
            <option value="">Equipo</option>
            {equipmentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          <Select value={movementType} onChange={(value) => setMovementType(value as MovementType | "")}>
            <option value="">Movimiento</option>
            <option value="COMPOUND">Compuesto</option>
            <option value="ISOLATION">Aislamiento</option>
          </Select>
        </div>
      </details>

      {showCreateForm && (
        <Card>
          <p className="mb-3 text-sm font-semibold">Agregar ejercicio propio</p>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <FieldLabel>
              Nombre
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <FieldLabel>
                Grupo muscular
                <Input value={newMuscleGroup} onChange={(event) => setNewMuscleGroup(event.target.value)} />
              </FieldLabel>
              <FieldLabel>
                Equipo
                <Input value={newEquipmentType} onChange={(event) => setNewEquipmentType(event.target.value)} />
              </FieldLabel>
            </div>
            <FieldLabel>
              Tipo de movimiento
              <Select value={newMovementType} onChange={(value) => setNewMovementType(value as MovementType)}>
                <option value="COMPOUND">Compuesto</option>
                <option value="ISOLATION">Aislamiento</option>
              </Select>
            </FieldLabel>
            {formError && (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            )}
            <Button type="submit" loading={createExercise.isPending}>
              Crear ejercicio
            </Button>
          </form>
        </Card>
      )}

      {isLoading && <p className="text-fg-muted">Cargando...</p>}
      {error && <p className="text-sm text-danger">No se pudieron cargar los ejercicios.</p>}

      <div className="flex flex-col gap-3">
        {grouped.map(([group, exercises]) => {
          const color = colorForLabel(group);
          return (
            <section key={group} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <span className={`size-2 rounded-full ${color.dot}`} />
                <h2 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                  {group} ({exercises.length})
                </h2>
              </div>
              <Card className="divide-y divide-border overflow-hidden p-0">
                {exercises.map((exercise) => {
                  const isOwn = exercise.ownerId === user?.id;
                  const isEditing = editingId === exercise.id;
                  return (
                    <div key={exercise.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${color.soft}`}>
                        <Dumbbell className={`size-5 ${color.fg}`} />
                      </span>

                      {isEditing ? (
                        <form
                          className="flex flex-1 gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            updateExercise.mutate(exercise.id);
                          }}
                        >
                          <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                          <Button type="submit" className="shrink-0 px-3 py-1 text-sm" loading={updateExercise.isPending}>
                            Guardar
                          </Button>
                        </form>
                      ) : (
                        <Link
                          to={`/exercises/${exercise.id}/progress`}
                          className="flex min-w-0 flex-1 items-center gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{exercise.name}</p>
                            <p className="truncate text-sm text-fg-muted">
                              {exercise.equipmentType} · {MOVEMENT_LABELS[exercise.movementType]}
                            </p>
                          </div>
                          {exercise.personalRecord && (
                            <span className="shrink-0 text-sm font-semibold text-pr">
                              {kgToDisplay(exercise.personalRecord.weightKg, unit)}
                              {unitLabel(unit)} PR
                            </span>
                          )}
                          {!isOwn && (
                            <>
                              <span className="shrink-0 text-xs text-fg-subtle">Global</span>
                              <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
                            </>
                          )}
                        </Link>
                      )}

                      {!isEditing && isOwn && (
                        <Menu
                          items={[
                            {
                              label: "Editar",
                              icon: <Pencil className="size-4" />,
                              onClick: () => {
                                setEditingId(exercise.id);
                                setEditName(exercise.name);
                              },
                            },
                            {
                              label: "Borrar",
                              icon:
                                deleteExercise.isPending && deleteExercise.variables === exercise.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                ),
                              variant: "danger",
                              disabled: deleteExercise.isPending,
                              onClick: () => deleteExercise.mutate(exercise.id),
                            },
                          ]}
                        />
                      )}
                    </div>
                  );
                })}
              </Card>
            </section>
          );
        })}
        {!isLoading && filtered.length === 0 && <p className="text-fg-muted">No hay ejercicios con esos filtros.</p>}
      </div>
    </main>
  );
}
