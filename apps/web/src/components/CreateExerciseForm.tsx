import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MovementType } from "@routine-tracker/shared";
import { useAuth } from "../lib/auth";
import { apiFetch, ApiError } from "../lib/api";
import { Button, FieldLabel, Input, Select } from "./ui";

export type CreatedExercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipmentType: string;
  movementType: MovementType;
};

export function CreateExerciseForm({
  initialName = "",
  onCreated,
  onCancel,
}: {
  initialName?: string;
  onCreated: (exercise: CreatedExercise) => void;
  onCancel: () => void;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(initialName);
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("COMPOUND");
  const [error, setError] = useState<string | null>(null);

  const createExercise = useMutation({
    mutationFn: () =>
      apiFetch<CreatedExercise>("/exercises", {
        method: "POST",
        token,
        body: { name: name.trim(), muscleGroup: muscleGroup.trim(), equipmentType: equipmentType.trim(), movementType },
      }),
    onSuccess: (exercise) => {
      void queryClient.invalidateQueries({ queryKey: ["exercises"] });
      void queryClient.invalidateQueries({ queryKey: ["exercises-for-new-routine"] });
      void queryClient.invalidateQueries({ queryKey: ["exercises-for-routine"] });
      void queryClient.invalidateQueries({ queryKey: ["muscle-groups"] });
      onCreated(exercise);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !muscleGroup.trim() || !equipmentType.trim()) return;
    createExercise.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <p className="text-sm font-semibold">Crear ejercicio nuevo</p>
      <FieldLabel>
        Nombre
        <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-2">
        <FieldLabel>
          Grupo muscular
          <Input value={muscleGroup} onChange={(event) => setMuscleGroup(event.target.value)} />
        </FieldLabel>
        <FieldLabel>
          Aparato
          <Input value={equipmentType} onChange={(event) => setEquipmentType(event.target.value)} />
        </FieldLabel>
      </div>
      <FieldLabel>
        Tipo de movimiento
        <Select value={movementType} onChange={(value) => setMovementType(value as MovementType)}>
          <option value="COMPOUND">Compuesto</option>
          <option value="ISOLATION">Aislamiento</option>
        </Select>
      </FieldLabel>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={createExercise.isPending} className="flex-1">
          Crear
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
