import { useNavigate } from "react-router";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { Button, Card } from "../components/ui";

type Session = {
  id: string;
  routineId: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export function SessionsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-neutral-950 px-4 py-8 text-neutral-100">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Sesiones</h1>
        <Button onClick={() => createSession.mutate()} disabled={createSession.isPending}>
          Nueva sesión libre
        </Button>
      </div>

      {isLoading && <p className="text-neutral-400">Cargando...</p>}

      {sessions?.length === 0 && <p className="text-neutral-400">Todavía no registraste ninguna sesión.</p>}

      <ul className="flex flex-col gap-2">
        {sessions?.map((session) => (
          <li key={session.id}>
            <Link to={`/sessions/${session.id}`}>
              <Card className="flex items-center justify-between">
                <span>{new Date(session.startedAt).toLocaleString()}</span>
                <span className={session.finishedAt ? "text-sm text-neutral-500" : "text-sm text-green-400"}>
                  {session.finishedAt ? "Finalizada" : "En curso"}
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
