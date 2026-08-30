import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import { DAY_LABELS, DAY_ORDER } from "../../lib/days";
import { Button, Card, IconButton } from "../../components/ui";
import { ConfirmDialog } from "../../components/ConfirmDialog";

type Session = {
  id: string;
  routineId: string | null;
  routineName: string | null;
  startedAt: string;
  finishedAt: string | null;
  volumeKg: number;
};

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthGrid(viewDate: Date): (Date | null)[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: (Date | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  return cells;
}

function computeDayStreak(trainedDayKeys: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  while (trainedDayKeys.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const WEEKDAY_LABELS = DAY_ORDER.map((day) => DAY_LABELS[day]);

export function SessionsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions", token],
    queryFn: () => apiFetch<Session[]>("/sessions", { token }),
  });

  const createSession = useMutation({
    mutationFn: () => apiFetch<Session>("/sessions", { method: "POST", token, body: {} }),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate(`/sessions/${session.id}`);
    },
  });

  const deleteSession = useMutation({
    mutationFn: (sessionId: string) => apiFetch<void>(`/sessions/${sessionId}`, { method: "DELETE", token }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setSessionToDelete(null);
    },
  });

  const trainedDayKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const session of sessions ?? []) {
      if (session.finishedAt) keys.add(dateKey(new Date(session.startedAt)));
    }
    return keys;
  }, [sessions]);

  const dayStreak = useMemo(() => computeDayStreak(trainedDayKeys), [trainedDayKeys]);

  const monthSessions = useMemo(() => {
    return (sessions ?? []).filter((session) => {
      const started = new Date(session.startedAt);
      return started.getFullYear() === viewDate.getFullYear() && started.getMonth() === viewDate.getMonth();
    });
  }, [sessions, viewDate]);

  const monthVolumeKg = monthSessions.reduce((sum, session) => sum + session.volumeKg, 0);
  const monthGrid = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const monthLabel = viewDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const today = new Date();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 bg-canvas px-4 pt-4 pb-24 text-fg">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Historial</h1>
        <Button onClick={() => createSession.mutate()} loading={createSession.isPending}>
          Nueva sesión libre
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="flex flex-col gap-1">
          <span className="text-2xl font-bold text-accent">{monthSessions.length}</span>
          <span className="text-xs text-fg-muted">Sesiones</span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-2xl font-bold text-group-3">{monthVolumeKg}</span>
          <span className="text-xs text-fg-muted">Vol (kg)</span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-2xl font-bold text-group-1">{dayStreak}</span>
          <span className="text-xs text-fg-muted">Racha</span>
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <IconButton
            aria-label="Mes anterior"
            className="size-8"
            onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
          >
            <ChevronLeft className="size-4" />
          </IconButton>
          <p className="font-semibold capitalize">{monthLabel}</p>
          <IconButton
            aria-label="Mes siguiente"
            className="size-8"
            onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
          >
            <ChevronRight className="size-4" />
          </IconButton>
        </div>

        <div className="grid grid-cols-7 gap-y-2 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="text-xs font-medium text-fg-subtle">
              {label}
            </span>
          ))}
          {monthGrid.map((date, index) => {
            if (!date) return <span key={`empty-${index}`} />;
            const isToday = dateKey(date) === dateKey(today);
            const isTrained = trainedDayKeys.has(dateKey(date));
            return (
              <div key={dateKey(date)} className="flex flex-col items-center gap-1">
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-sm ${
                    isToday ? "border border-accent font-semibold text-accent" : "text-fg"
                  }`}
                >
                  {date.getDate()}
                </span>
                <span className={`size-1.5 rounded-full ${isTrained ? "bg-accent" : "bg-transparent"}`} />
              </div>
            );
          })}
        </div>
      </Card>

      <h2 className="px-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">Todos los entrenos</h2>

      {isLoading && <p className="text-fg-muted">Cargando...</p>}

      {!isLoading && monthSessions.length === 0 && (
        <p className="text-fg-muted">No hay entrenos registrados en {monthLabel}.</p>
      )}

      {monthSessions.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {monthSessions.map((session) => (
            <div key={session.id} className="flex items-center gap-3 px-2 py-2">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-group-5-soft">
                <CalendarClock className="size-5 text-group-5" />
              </span>
              <Link to={`/sessions/${session.id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold">{session.routineName ?? "Sesión libre"}</p>
                <div className="flex items-center gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-sm text-fg-muted">
                    {new Date(session.startedAt).toLocaleDateString()}{" "}
                    {new Date(session.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      session.finishedAt ? "bg-surface-muted text-fg-muted" : "bg-group-2-soft text-group-2"
                    }`}
                  >
                    {session.finishedAt ? "Finalizada" : "En curso"}
                  </span>
                </div>
              </Link>
              <IconButton
                aria-label="Borrar sesión"
                className="size-8 text-danger hover:bg-danger-soft"
                onClick={() => setSessionToDelete(session.id)}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={sessionToDelete !== null}
        title="Borrar sesión"
        message="Se van a perder todas las series registradas. Esta acción no se puede deshacer."
        confirmLabel="Borrar"
        isPending={deleteSession.isPending}
        onConfirm={() => {
          if (sessionToDelete) deleteSession.mutate(sessionToDelete);
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </main>
  );
}
