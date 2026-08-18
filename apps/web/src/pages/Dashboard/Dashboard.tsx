import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import { Card } from "../../components/ui";

type RecentSession = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  routineId: string | null;
  routineName: string | null;
};

type RoutineSummary = { id: string; name: string };

type ReadyToProgress = { exerciseId: string; exerciseName: string; suggestedWeightIncrease: number };

type Dashboard = {
  recentSessions: RecentSession[];
  routines: RoutineSummary[];
  readyToProgress: ReadyToProgress[];
};

export function DashboardPage() {
  const { token, user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", token],
    queryFn: () => apiFetch<Dashboard>("/dashboard", { token }),
  });

  const isEmpty = data && data.recentSessions.length === 0 && data.routines.length === 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-neutral-950 px-4 py-8 text-neutral-100">
      <div>
        <h1 className="text-xl font-semibold">Hola{user?.name ? `, ${user.name}` : ""}</h1>
        <p className="text-sm text-neutral-400">Tu resumen de entrenamiento</p>
      </div>

      {isLoading && <p className="text-neutral-400">Cargando...</p>}

      {isEmpty && (
        <Card className="flex flex-col gap-3">
          <p className="text-neutral-300">Todavía no tenés nada cargado.</p>
          <Link to="/routines" className="text-sm font-medium text-neutral-100 underline">
            Creá tu primera rutina →
          </Link>
        </Card>
      )}

      {data && data.readyToProgress.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-400">Listos para progresar</h2>
          <ul className="flex flex-col gap-2">
            {data.readyToProgress.map((item) => (
              <li key={item.exerciseId}>
                <Link to={`/exercises/${item.exerciseId}/progress`}>
                  <Card className="flex items-center justify-between border-emerald-500/30 bg-emerald-500/10">
                    <span className="font-medium">{item.exerciseName}</span>
                    <span className="text-sm font-semibold text-emerald-400">
                      +{item.suggestedWeightIncrease}kg sugerido
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data && data.readyToProgress.length === 0 && !isEmpty && (
        <p className="text-sm text-neutral-500">Todavía no hay sugerencias — seguí entrenando.</p>
      )}

      {data && data.recentSessions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Sesiones recientes</h2>
          <ul className="flex flex-col gap-2">
            {data.recentSessions.map((session) => (
              <li key={session.id}>
                <Link to={`/sessions/${session.id}`}>
                  <Card className="flex items-center justify-between">
                    <span>
                      <span className="block">{session.routineName ?? "Sesión libre"}</span>
                      <span className="block text-sm text-neutral-500">
                        {new Date(session.startedAt).toLocaleDateString()}
                      </span>
                    </span>
                    <span className={session.finishedAt ? "text-sm text-neutral-500" : "text-sm text-green-400"}>
                      {session.finishedAt ? "Finalizada" : "En curso"}
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && data.routines.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Tus rutinas</h2>
          <ul className="flex flex-col gap-2">
            {data.routines.map((routine) => (
              <li key={routine.id}>
                <Link to={`/routines/${routine.id}`}>
                  <Card>{routine.name}</Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
