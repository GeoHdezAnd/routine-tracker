import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { Card } from "../components/ui";

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
  const { token } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["exercise-progress", id, token],
    queryFn: () => apiFetch<ExerciseProgress>(`/exercises/${id}/progress`, { token }),
    enabled: id !== undefined,
  });

  const chartData = (data?.history ?? []).map((entry) => ({
    date: new Date(entry.date).toLocaleDateString(),
    weightKg: entry.weightKg,
    estimated1RM: Math.round(entry.estimated1RM * 10) / 10,
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-neutral-950 px-4 py-8 text-neutral-100">
      <Link to="/exercises" className="text-sm text-neutral-400 underline">
        ← Volver a ejercicios
      </Link>

      <h1 className="text-xl font-semibold">Progreso</h1>

      {isLoading && <p className="text-neutral-400">Cargando...</p>}

      {data?.readyToProgress && (
        <Card className="border-emerald-500/30 bg-emerald-500/10">
          <span className="font-medium text-emerald-400">
            Listo para subir peso: +{data.suggestedWeightIncrease}kg
          </span>
        </Card>
      )}

      {data && data.history.length === 0 && (
        <p className="text-neutral-400">Todavía no registraste series de este ejercicio.</p>
      )}

      {data && data.history.length > 0 && (
        <>
          <Card className="h-64 px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" stroke="#a3a3a3" fontSize={12} />
                <YAxis stroke="#a3a3a3" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626", color: "#f5f5f5" }}
                />
                <Line type="monotone" dataKey="weightKg" name="Peso (kg)" stroke="#f5f5f5" strokeWidth={2} dot={false} />
                <Line
                  type="monotone"
                  dataKey="estimated1RM"
                  name="1RM estimado"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <ul className="flex flex-col gap-2">
            {[...data.history].reverse().map((entry) => (
              <Card key={`${entry.sessionId}-${entry.date}-${entry.weightKg}-${entry.reps}`} className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">{new Date(entry.date).toLocaleDateString()}</span>
                <span className="text-sm">
                  {entry.weightKg}kg x {entry.reps}
                  {entry.rir !== null ? ` · RIR ${entry.rir}` : ""}
                </span>
                <span className="text-sm text-neutral-500">1RM ~{Math.round(entry.estimated1RM)}kg</span>
              </Card>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
