import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { MovementType } from "@routine-tracker/shared";
import { Dumbbell, TrendingUp } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import { colorForLabel } from "../../lib/colors";
import { Card } from "../../components/ui";

type ExerciseDetail = {
  id: string;
  name: string;
  muscleGroup: string;
  equipmentType: string;
  movementType: MovementType;
  imageUrl?: string | null;
  startPosition?: string | null;
  execution?: string | null;
  equipment: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

const MOVEMENT_LABELS: Record<MovementType, string> = {
  COMPOUND: "Compuesto",
  ISOLATION: "Aislamiento",
};

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-surface-muted px-3 py-1 text-sm text-fg-muted">
          {item}
        </span>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

function HeroImage({
  imageUrl,
  swatch,
}: {
  imageUrl?: string | null;
  swatch: { soft: string; fg: string };
}) {
  const [hasError, setHasError] = useState(false);

  if (imageUrl && !hasError) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="aspect-square w-full rounded-2xl bg-surface-muted object-contain"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <span className={`flex h-40 items-center justify-center rounded-2xl ${swatch.soft}`}>
      <Dumbbell className={`size-10 ${swatch.fg}`} />
    </span>
  );
}

export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();

  const { data: exercise, isLoading, error } = useQuery({
    queryKey: ["exercise", id, token],
    queryFn: () => apiFetch<ExerciseDetail>(`/exercises/${id}`, { token }),
    enabled: id !== undefined,
  });

  const color = exercise ? colorForLabel(exercise.muscleGroup) : null;
  const hasGuide =
    exercise !== undefined &&
    (exercise.startPosition || exercise.execution || exercise.primaryMuscles.length > 0 || exercise.equipment.length > 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-canvas px-4 pt-4 pb-24 text-fg">
      <Link to="/exercises" className="text-sm text-fg-muted underline">
        ← Volver a ejercicios
      </Link>

      {isLoading && <p className="text-fg-muted">Cargando...</p>}
      {error && <p className="text-sm text-danger">No se pudo cargar el ejercicio.</p>}

      {exercise && color && (
        <>
          <div className="flex flex-col gap-3">
            <HeroImage imageUrl={exercise.imageUrl} swatch={color} />
            <h1 className="text-xl font-semibold">{exercise.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color.soft} ${color.fg}`}>
                {exercise.muscleGroup}
              </span>
              <span className="text-sm text-fg-muted">
                {exercise.equipmentType} · {MOVEMENT_LABELS[exercise.movementType]}
              </span>
            </div>
            <Link to={`/exercises/${exercise.id}/progress`} className="inline-flex items-center gap-2 text-sm underline">
              <TrendingUp className="size-4" />
              Ver progreso
            </Link>
          </div>

          {exercise.equipment.length > 0 && (
            <Section title="Equipamiento">
              <Chips items={exercise.equipment} />
            </Section>
          )}

          {exercise.primaryMuscles.length > 0 && (
            <Section title="Músculos principales">
              <Chips items={exercise.primaryMuscles} />
            </Section>
          )}

          {exercise.secondaryMuscles.length > 0 && (
            <Section title="Músculos secundarios">
              <Chips items={exercise.secondaryMuscles} />
            </Section>
          )}

          {exercise.startPosition && (
            <Section title="Posición inicial">
              <Card>
                <p className="whitespace-pre-line text-sm">{exercise.startPosition}</p>
              </Card>
            </Section>
          )}

          {exercise.execution && (
            <Section title="Ejecución">
              <Card>
                <p className="whitespace-pre-line text-sm">{exercise.execution}</p>
              </Card>
            </Section>
          )}

          {!hasGuide && <p className="text-fg-muted">Este ejercicio no tiene guía.</p>}
        </>
      )}
    </main>
  );
}
