import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import { kgToDisplay, unitLabel } from "../../lib/units";
import { Card } from "../../components/ui";

type HistoryEntry = {
  sessionId: string;
  date: string;
  weightKg: number;
  reps: number;
  rir: number | null;
  estimated1RM: number;
};

type ExerciseProgress = {
  history: HistoryEntry[];
  readyToProgress: boolean;
  suggestedWeightIncrease: number | null;
};

export function ExerciseProgressPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const unit = user?.unitPreference ?? "KG";

  const { data, isLoading } = useQuery({
    queryKey: ["exercise-progress", id, token],
    queryFn: () => apiFetch<ExerciseProgress>(`/exercises/${id}/progress`, { token }),
    enabled: id !== undefined,
  });

  const chartData = (data?.history ?? []).map((entry) => ({
    date: new Date(entry.date).toLocaleDateString(),
    weightDisplay: kgToDisplay(entry.weightKg, unit),
    estimated1RM: kgToDisplay(entry.estimated1RM, unit),
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-canvas px-4 pt-8 pb-24 text-fg">
      <Link to="/exercises" className="text-sm text-fg-muted underline">
        ← Volver a ejercicios
      </Link>

      <h1 className="text-xl font-semibold">Progreso</h1>

      {isLoading && <p className="text-fg-muted">Cargando...</p>}

      {data?.readyToProgress && (
        <Card className="border-group-2/30 bg-group-2-soft">
          <span className="font-medium text-group-2">
            Listo para subir peso: +{kgToDisplay(data.suggestedWeightIncrease!, unit)}{unitLabel(unit)}
          </span>
        </Card>
      )}

      {data && data.history.length === 0 && (
        <p className="text-fg-muted">Todavía no registraste series de este ejercicio.</p>
      )}

      {data && data.history.length > 0 && (
        <>
          <Card className="h-64 px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-fg-muted)" fontSize={12} />
                <YAxis stroke="var(--color-fg-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-fg)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="weightDisplay"
                  name={`Peso (${unitLabel(unit)})`}
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="estimated1RM"
                  name="1RM estimado"
                  stroke="var(--color-group-2)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <ul className="flex flex-col gap-2">
            {[...data.history].reverse().map((entry) => (
              <Card key={`${entry.sessionId}-${entry.date}-${entry.weightKg}-${entry.reps}`} className="flex items-center justify-between">
                <span className="text-sm text-fg-muted">{new Date(entry.date).toLocaleDateString()}</span>
                <span className="text-sm">
                  {kgToDisplay(entry.weightKg, unit)}{unitLabel(unit)} x {entry.reps}
                  {entry.rir !== null ? ` · RIR ${entry.rir}` : ""}
                </span>
                <span className="text-sm text-fg-subtle">
                  1RM ~{Math.round(kgToDisplay(entry.estimated1RM, unit))}{unitLabel(unit)}
                </span>
              </Card>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
