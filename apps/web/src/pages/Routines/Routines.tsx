import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Dumbbell, Plus, X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { colorForLabel } from "../../lib/colors";
import { Button, Card, IconButton, Input } from "../../components/ui";

type Routine = {
  id: string;
  name: string;
  createdAt: string;
};

type Session = { id: string };

export function RoutinesPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: routines, isLoading } = useQuery({
    queryKey: ["routines", token],
    queryFn: () => apiFetch<Routine[]>("/routines", { token }),
  });

  const createRoutine = useMutation({
    mutationFn: (routineName: string) =>
      apiFetch<Routine>("/routines", { method: "POST", token, body: { name: routineName } }),
    onSuccess: () => {
      setName("");
      setShowCreateForm(false);
      void queryClient.invalidateQueries({ queryKey: ["routines", token] });
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado");
    },
  });

  const startSession = useMutation({
    mutationFn: (routineId: string) => apiFetch<Session>("/sessions", { method: "POST", token, body: { routineId } }),
    onSuccess: (session) => navigate(`/sessions/${session.id}`),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    createRoutine.mutate(trimmed);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 bg-canvas px-4 pt-8 pb-24 text-fg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rutinas</h1>
          {user && <p className="text-sm text-fg-muted">{user.name ?? user.email}</p>}
        </div>
        <IconButton
          aria-label={showCreateForm ? "Cerrar formulario" : "Nueva rutina"}
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? <X className="size-6" /> : <Plus className="size-6" />}
        </IconButton>
      </div>

      {showCreateForm && (
        <Card>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              placeholder="Nombre de la rutina"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              className="flex-1"
            />
            <Button type="submit" disabled={createRoutine.isPending} className="shrink-0">
              Crear
            </Button>
          </form>
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
        </Card>
      )}

      {isLoading && <p className="text-fg-muted">Cargando...</p>}

      {!isLoading && routines && routines.length === 0 && (
        <p className="text-fg-muted">Todavía no tenés rutinas, creá la primera.</p>
      )}

      {routines && routines.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {routines.map((routine) => {
            const color = colorForLabel(routine.name);
            return (
              <div key={routine.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${color.soft}`}>
                  <Dumbbell className={`size-5 ${color.fg}`} />
                </span>
                <Link to={`/routines/${routine.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{routine.name}</p>
                  <p className="truncate text-sm text-fg-muted">
                    Creada el {new Date(routine.createdAt).toLocaleDateString()}
                  </p>
                </Link>
                <button
                  type="button"
                  disabled={startSession.isPending}
                  onClick={() => startSession.mutate(routine.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${color.soft} ${color.fg}`}
                >
                  Iniciar
                </button>
                <Link to={`/routines/${routine.id}`} className="shrink-0 text-fg-subtle">
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            );
          })}
        </Card>
      )}
    </main>
  );
}
