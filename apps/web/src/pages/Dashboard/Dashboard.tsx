import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  durationSeconds: number | null;
  volumeKg: number;
};

type TodayRoutine = { routineId: string; routineName: string; exerciseCount: number };

type RoutineSummary = { id: string; name: string };

type ReadyToProgress = { exerciseId: string; exerciseName: string; suggestedWeightIncrease: number };

type Dashboard = {
  dayStreak: number;
  sessionsThisWeek: number;
  totalWorkouts: number;
  today: TodayRoutine | null;
  recentSessions: RecentSession[];
  routines: RoutineSummary[];
  readyToProgress: ReadyToProgress[];
};

type Session = { id: string };

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const diffDays = Math.round((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays > 1 && diffDays < 7) return `Hace ${diffDays} d`;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function DashboardPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", token],
    queryFn: () => apiFetch<Dashboard>(`/dashboard?tzOffsetMinutes=${-new Date().getTimezoneOffset()}`, { token }),
  });

  const startSession = useMutation({
    mutationFn: (routineId: string) => apiFetch<Session>("/sessions", { method: "POST", token, body: { routineId } }),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/sessions/${session.id}`);
    },
  });

  const isEmpty = data && data.recentSessions.length === 0 && data.routines.length === 0;
  const todayColor = data?.today ? colorForLabel(data.today.routineName) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-canvas px-4 pt-8 pb-24 text-fg">
      <div>
        <p className="text-sm text-fg-muted capitalize">
          {new Date().toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
        </p>
        <h1 className="text-3xl font-bold">
          {getGreeting()}
          {user?.name ? `, ${user.name}` : ""} 💪
        </h1>
      </div>

      {isLoading && <p className="text-fg-muted">Cargando...</p>}

      {isEmpty && (
        <Card className="flex flex-col gap-3">
          <p className="text-fg-muted">Todavía no tienes nada cargado.</p>
          <Link to="/routines" className="text-sm font-semibold text-accent">
            Crea tu primera rutina →
          </Link>
        </Card>
      )}

      {data && !isEmpty && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="flex flex-col gap-1">
            <span className="text-2xl font-bold text-group-1">{data.dayStreak}</span>
            <span className="text-xs text-fg-muted">días</span>
            <span className="text-sm font-semibold">Racha</span>
          </Card>
          <Card className="flex flex-col gap-1">
            <span className="text-2xl font-bold text-accent">{data.sessionsThisWeek}</span>
            <span className="text-xs text-fg-muted">sesiones</span>
            <span className="text-sm font-semibold">Esta semana</span>
          </Card>
          <Card className="flex flex-col gap-1">
            <span className="text-2xl font-bold text-group-3">{data.totalWorkouts}</span>
            <span className="text-xs text-fg-muted">entrenos</span>
            <span className="text-sm font-semibold">Total</span>
          </Card>
        </div>
      )}

      {data?.today && todayColor && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">Hoy</h2>
          <Card className="flex items-center gap-3">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${todayColor.soft}`}>
              <Dumbbell className={`size-5 ${todayColor.fg}`} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{data.today.routineName}</p>
              <p className="text-sm text-fg-muted">{data.today.exerciseCount} ejercicios</p>
            </div>
            <button
              type="button"
              disabled={startSession.isPending}
              onClick={() => startSession.mutate(data.today!.routineId)}
              className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              Iniciar
            </button>
          </Card>
        </section>
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

      {data && data.recentSessions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">Entrenos recientes</h2>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {data.recentSessions.map((session) => (
              <Link key={session.id} to={`/sessions/${session.id}`} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-group-5-soft">
                  <CalendarClock className="size-5 text-group-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{session.routineName ?? "Sesión libre"}</span>
                  <span className="block text-sm text-fg-muted">
                    {formatRelativeDate(session.startedAt)} ·{" "}
                    {session.durationSeconds !== null ? formatDuration(session.durationSeconds) : "En curso"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold">{session.volumeKg}</span>
                  <span className="block text-xs text-fg-muted">kg vol</span>
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}

      {data && data.routines.length > 0 && !data.today && (
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
