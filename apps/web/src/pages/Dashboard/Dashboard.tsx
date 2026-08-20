import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronRight, Dumbbell, TrendingUp } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import { colorForLabel } from "../../lib/colors";
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-canvas px-4 pt-8 pb-24 text-fg">
      <div>
        <h1 className="text-3xl font-bold">Hola{user?.name ? `, ${user.name}` : ""}</h1>
        <p className="text-sm text-fg-muted">Tu resumen de entrenamiento</p>
      </div>

      {isLoading && <p className="text-fg-muted">Cargando...</p>}

      {isEmpty && (
        <Card className="flex flex-col gap-3">
          <p className="text-fg-muted">Todavía no tenés nada cargado.</p>
          <Link to="/routines" className="text-sm font-semibold text-accent">
            Creá tu primera rutina →
          </Link>
        </Card>
      )}

      {data && data.readyToProgress.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">Listos para progresar</h2>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {data.readyToProgress.map((item) => (
              <Link
                key={item.exerciseId}
                to={`/exercises/${item.exerciseId}/progress`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-group-2-soft">
                  <TrendingUp className="size-5 text-group-2" />
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{item.exerciseName}</span>
                <span className="shrink-0 text-sm font-semibold text-group-2">
                  +{item.suggestedWeightIncrease}kg sugerido
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}
      {data && data.readyToProgress.length === 0 && !isEmpty && (
        <p className="text-sm text-fg-subtle">Todavía no hay sugerencias — sigue entrenando.</p>
      )}

      {data && data.recentSessions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">Sesiones recientes</h2>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {data.recentSessions.map((session) => (
              <Link key={session.id} to={`/sessions/${session.id}`} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-group-5-soft">
                  <CalendarClock className="size-5 text-group-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{session.routineName ?? "Sesión libre"}</span>
                  <span className="block text-sm text-fg-muted">
                    {new Date(session.startedAt).toLocaleDateString()}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    session.finishedAt ? "bg-surface-muted text-fg-muted" : "bg-group-2-soft text-group-2"
                  }`}
                >
                  {session.finishedAt ? "Finalizada" : "En curso"}
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}

      {data && data.routines.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">Tus rutinas</h2>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {data.routines.map((routine) => {
              const color = colorForLabel(routine.name);
              return (
                <Link key={routine.id} to={`/routines/${routine.id}`} className="flex items-center gap-3 px-4 py-3">
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${color.soft}`}>
                    <Dumbbell className={`size-5 ${color.fg}`} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{routine.name}</span>
                  <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
                </Link>
              );
            })}
          </Card>
        </section>
      )}
    </main>
  );
}
