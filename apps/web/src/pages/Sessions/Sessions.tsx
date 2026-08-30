import { useState } from "react";
import { useNavigate } from "react-router";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Trash2 } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import { Button, Card, IconButton } from "../../components/ui";
import { ConfirmDialog } from "../../components/ConfirmDialog";

type Session = {
  id: string;
  routineId: string | null;
  routineName: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export function SessionsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 bg-canvas px-4 pt-4 pb-24 text-fg">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Sesiones</h1>
        <Button onClick={() => createSession.mutate()} loading={createSession.isPending}>
          Nueva sesión libre
        </Button>
      </div>

      {isLoading && <p className="text-fg-muted">Cargando...</p>}

      {sessions?.length === 0 && <p className="text-fg-muted">Todavía no registraste ninguna sesión.</p>}

      {sessions && sessions.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {sessions.map((session) => (
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
