import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Dumbbell, Play, Plus, X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { colorForLabel } from "../../lib/colors";
import { Button, Card, IconButton, Input, Pill } from "../../components/ui";

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
  const [showArchived, setShowArchived] = useState(false);

  const { data: routines, isLoading } = useQuery({
    queryKey: ["routines", token, showArchived],
    queryFn: () => apiFetch<Routine[]>(`/routines${showArchived ? "?archived=true" : ""}`, { token }),
  });

  function invalidateRoutines() {
    void queryClient.invalidateQueries({ queryKey: ["routines", token] });
  }

  const createRoutine = useMutation({
    mutationFn: (routineName: string) =>
      apiFetch<Routine>("/routines", { method: "POST", token, body: { name: routineName } }),
    onSuccess: () => {
      setName("");
      setShowCreateForm(false);
      invalidateRoutines();
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado");
    },
  });

  const startSession = useMutation({
    mutationFn: (routineId: string) => apiFetch<Session>("/sessions", { method: "POST", token, body: { routineId } }),
    onSuccess: (session) => navigate(`/sessions/${session.id}`),
  });

  const setArchived = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      apiFetch<Routine>(`/routines/${id}`, { method: "PATCH", token, body: { archived } }),
    onSuccess: () => invalidateRoutines(),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    createRoutine.mutate(trimmed);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 bg-canvas px-4 pt-4 pb-24 text-fg">
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

      <div className="flex gap-2">
        <Pill active={!showArchived} onClick={() => setShowArchived(false)}>
          Activas
        </Pill>
        <Pill active={showArchived} onClick={() => setShowArchived(true)}>
          Archivadas
        </Pill>
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
        <p className="text-fg-muted">
          {showArchived ? "No tienes rutinas archivadas." : "Todavía no tienes rutinas, crea la primera."}
        </p>
      )}

      {routines && routines.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {routines.map((routine) => {
            const color = colorForLabel(routine.name);
            return (
              <div key={routine.id} className="flex items-center gap-3 px-1 py-2">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${color.soft}`}>
                  <Dumbbell className={`size-5 ${color.fg}`} />
                </span>
                <Link to={`/routines/${routine.id}`} className="min-w-0 flex-1">
                  <p className="truncate md:text-sm font-semibold">{routine.name}</p>
                  <p className="truncate text-xs text-fg-muted">
                    Creada el {new Date(routine.createdAt).toLocaleDateString()}
                  </p>
                </Link>
                {showArchived ? (
                  <IconButton
                    aria-label="Restaurar rutina"
                    disabled={setArchived.isPending}
                    onClick={() => setArchived.mutate({ id: routine.id, archived: false })}
                  >
                    <ArchiveRestore className="size-5" />
                  </IconButton>
                ) : (
                  <div className="flex">
                    <button
                      type="button"
                      disabled={startSession.isPending}
                      onClick={() => startSession.mutate(routine.id)}
                      aria-label="Iniciar rutina"
                      className="shrink-0 rounded-full bg-green-100 m-1 p-2 text-green-600 transition-colors hover:bg-green-200 disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" fill="currentColor" />
                    </button>
                    <IconButton
                      aria-label="Archivar rutina"
                      className="size-8"
                      disabled={setArchived.isPending}
                      onClick={() => setArchived.mutate({ id: routine.id, archived: true })}
                    >
                      <Archive className="size-4" />
                    </IconButton>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </main>
  );
}
