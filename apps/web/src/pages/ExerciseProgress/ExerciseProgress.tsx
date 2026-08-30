import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trophy } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import { colorForLabel } from "../../lib/colors";
import { formatRelativeDate } from "../../lib/dates";
import { kgToDisplay, unitLabel } from "../../lib/units";
import { Card } from "../../components/ui";

type ProgressSet = {
  id: string;
  weightKg: number;
  reps: number;
  rir: number | null;
  estimated1RM: number;
  isTopOfDay: boolean;
};

type ProgressSession = {
  sessionId: string;
  date: string;
  sets: ProgressSet[];
  isNewPR: boolean;
};

type ProgressSummary = {
  sessionCount: number;
  bestWeightKg: number | null;
  bestVolumeSet: { weightKg: number; reps: number } | null;
};

type ExerciseProgress = {
  summary: ProgressSummary;
  sessions: ProgressSession[];
  readyToProgress: boolean;
  suggestedWeightIncrease: number | null;
};

type ExerciseHeader = { name: string; muscleGroup: string };

const CHART_SESSIONS_WINDOW = 8;

export function ExerciseProgressPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const unit = user?.unitPreference ?? "KG";

  const { data: exercise } = useQuery({
    queryKey: ["exercise", id, token],
    queryFn: () => apiFetch<ExerciseHeader>(`/exercises/${id}`, { token }),
    enabled: id !== undefined,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["exercise-progress", id, token],
    queryFn: () => apiFetch<ExerciseProgress>(`/exercises/${id}/progress`, { token }),
    enabled: id !== undefined,
  });

  const color = exercise ? colorForLabel(exercise.muscleGroup) : null;

  const chartData = (data?.sessions ?? []).slice(-CHART_SESSIONS_WINDOW).map((session) => {
    const topSet = session.sets.find((set) => set.isTopOfDay)!;
    return { date: formatRelativeDate(session.date), weightDisplay: kgToDisplay(topSet.weightKg, unit) };
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-canvas px-4 pt-4 pb-24 text-fg">
      <Link to="/exercises" className="text-sm text-fg-muted underline">
        ← Volver a ejercicios
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{exercise?.name ?? "Progreso"}</h1>
        {exercise && color && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color.soft} ${color.fg}`}>
            {exercise.muscleGroup}
          </span>
        )}
      </div>

      {isLoading && <p className="text-fg-muted">Cargando...</p>}

      {data?.readyToProgress && (
        <Card className="border-group-2/30 bg-group-2-soft">
          <span className="font-medium text-group-2">
            Listo para subir peso: +{kgToDisplay(data.suggestedWeightIncrease!, unit)}
            {unitLabel(unit)}
          </span>
        </Card>
      )}

      {data && data.sessions.length === 0 && (
        <p className="text-fg-muted">Todavía no registraste series de este ejercicio.</p>
      )}

      {data && data.sessions.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Card className="flex flex-col items-center gap-1 text-center">
              <span className="text-2xl font-bold text-accent">{data.summary.sessionCount}</span>
              <span className="text-xs text-fg-muted">Sesiones</span>
            </Card>
            <Card className="flex flex-col items-center gap-1 text-center">
              <span className="text-2xl font-bold text-pr">
                {data.summary.bestWeightKg !== null ? kgToDisplay(data.summary.bestWeightKg, unit) : "—"}
              </span>
              <span className="text-xs text-fg-muted">Mejor ({unitLabel(unit)})</span>
            </Card>
            <Card className="flex flex-col items-center gap-1 text-center">
              <span className="text-2xl font-bold text-group-2">
                {data.summary.bestVolumeSet
                  ? `${kgToDisplay(data.summary.bestVolumeSet.weightKg, unit)}×${data.summary.bestVolumeSet.reps}`
                  : "—"}
              </span>
              <span className="text-xs text-fg-muted">Mejor set</span>
            </Card>
          </div>

          <Card className="flex h-64 flex-col gap-2 px-2 py-4">
            <p className="px-2 text-sm font-semibold text-fg-muted">Progreso de peso ({unitLabel(unit)})</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="date" stroke="var(--color-fg-muted)" fontSize={12} />
                <YAxis stroke="var(--color-fg-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-fg)",
                  }}
                />
                <Bar dataKey="weightDisplay" name={`Peso (${unitLabel(unit)})`} radius={[4, 4, 0, 0]}>
                  {chartData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={index === chartData.length - 1 ? "var(--color-accent)" : "var(--color-border)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">Historial de series</h2>
            <div className="flex flex-col gap-2">
              {[...data.sessions].reverse().map((session) => (
                <Card key={session.sessionId} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{formatRelativeDate(session.date)}</span>
                    {session.isNewPR && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-pr/10 px-2 py-0.5 text-xs font-semibold text-pr">
                        <Trophy className="size-3" />
                        PR
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {session.sets.map((set) => (
                      <span
                        key={set.id}
                        className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap ${
                          set.isTopOfDay ? "bg-pr text-white" : "bg-surface-muted text-fg-muted"
                        }`}
                      >
                        {kgToDisplay(set.weightKg, unit)}
                        {unitLabel(unit)} × {set.reps}
                      </span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
