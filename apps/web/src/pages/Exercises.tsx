import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MovementType } from "@routine-tracker/shared";
import { useAuth } from "../lib/auth";
import { apiFetch, ApiError } from "../lib/api";
import { Button, Card, FieldLabel, Input, Select } from "../components/ui";

type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipmentType: string;
  movementType: MovementType;
  ownerId: string | null;
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
  const queryClient = useQueryClient();

  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [movementType, setMovementType] = useState<MovementType | "">("");

  const [name, setName] = useState("");
  const [newMuscleGroup, setNewMuscleGroup] = useState("");
  const [newEquipmentType, setNewEquipmentType] = useState("");
  const [newMovementType, setNewMovementType] = useState<MovementType>("COMPOUND");
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const query = new URLSearchParams({ limit: "100" });
  if (muscleGroup) query.set("muscleGroup", muscleGroup);
  if (equipmentType) query.set("equipmentType", equipmentType);
  if (movementType) query.set("movementType", movementType);

  const { data, isLoading, error } = useQuery({
    queryKey: ["exercises", token, muscleGroup, equipmentType, movementType],
    queryFn: () => apiFetch<ExercisesResponse>(`/exercises?${query.toString()}`, { token }),
  });

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-neutral-950 px-4 py-8 text-neutral-100">
      <h1 className="text-xl font-semibold">Ejercicios</h1>

      <div className="grid grid-cols-3 gap-2">
        <Input placeholder="Grupo muscular" value={muscleGroup} onChange={(event) => setMuscleGroup(event.target.value)} />
        <Input placeholder="Equipo" value={equipmentType} onChange={(event) => setEquipmentType(event.target.value)} />
        <Select value={movementType} onChange={(event) => setMovementType(event.target.value as MovementType | "")}>
          <option value="">Movimiento</option>
          <option value="COMPOUND">Compuesto</option>
          <option value="ISOLATION">Aislamiento</option>
        </Select>
      </div>

      <details className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">Agregar ejercicio propio</summary>
        <form onSubmit={handleCreate} className="mt-3 flex flex-col gap-3">
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
            <Select value={newMovementType} onChange={(event) => setNewMovementType(event.target.value as MovementType)}>
              <option value="COMPOUND">Compuesto</option>
              <option value="ISOLATION">Aislamiento</option>
            </Select>
          </FieldLabel>
          {formError && (
            <p role="alert" className="text-sm text-red-400">
              {formError}
            </p>
          )}
          <Button type="submit" disabled={createExercise.isPending}>
            Crear ejercicio
          </Button>
        </form>
      </details>

      {isLoading && <p className="text-neutral-400">Cargando...</p>}
      {error && <p className="text-sm text-red-400">No se pudieron cargar los ejercicios.</p>}

      <ul className="flex flex-col gap-2">
        {data?.data.map((exercise) => {
          const isOwn = exercise.ownerId === user?.id;
          const isEditing = editingId === exercise.id;
          return (
            <Card key={exercise.id} className="flex items-center justify-between gap-2">
              {isEditing ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    updateExercise.mutate(exercise.id);
                  }}
                >
                  <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                  <Button type="submit" className="shrink-0 px-3 py-1 text-sm">
                    Guardar
                  </Button>
                </form>
              ) : (
                <div>
                  <p className="font-medium">{exercise.name}</p>
                  <p className="text-sm text-neutral-400">
                    {exercise.muscleGroup} · {exercise.equipmentType} · {MOVEMENT_LABELS[exercise.movementType]}
                  </p>
                </div>
              )}
              {isOwn && !isEditing && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    className="px-3 py-1 text-sm"
                    onClick={() => {
                      setEditingId(exercise.id);
                      setEditName(exercise.name);
                    }}
                  >
                    Editar
                  </Button>
                  <Button variant="danger" className="px-3 py-1 text-sm" onClick={() => deleteExercise.mutate(exercise.id)}>
                    Borrar
                  </Button>
                </div>
              )}
              {!isOwn && <span className="shrink-0 text-xs text-neutral-500">Global</span>}
            </Card>
          );
        })}
        {data?.data.length === 0 && <p className="text-neutral-400">No hay ejercicios con esos filtros.</p>}
      </ul>
    </main>
  );
}
