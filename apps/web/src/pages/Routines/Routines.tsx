import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";

type Routine = {
  id: string;
  name: string;
  createdAt: string;
};

export function RoutinesPage() {
  const { token, user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: routines, isLoading } = useQuery({
    queryKey: ["routines", token],
    queryFn: () => apiFetch<Routine[]>("/routines", { token }),
  });

  const createRoutine = useMutation({
    mutationFn: (routineName: string) =>
      apiFetch<Routine>("/routines", { method: "POST", token, body: { name: routineName } }),
    onSuccess: () => {
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["routines", token] });
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof ApiError ? mutationError.message : "Ocurrió un error inesperado");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    createRoutine.mutate(trimmed);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-neutral-950 px-4 py-8 text-neutral-100">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Tus rutinas</h1>
          {user && <p className="text-sm text-neutral-400">{user.name ?? user.email}</p>}
        </div>
        <button type="button" onClick={logout} className="text-sm text-neutral-400 underline">
          Cerrar sesión
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder="Nombre de la rutina"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-base text-neutral-100"
        />
        <button
          type="submit"
          disabled={createRoutine.isPending}
          className="rounded-md bg-neutral-100 px-4 py-2 font-medium text-neutral-950 disabled:opacity-50"
        >
          Crear
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {isLoading && <p className="text-neutral-400">Cargando...</p>}

      {!isLoading && routines && routines.length === 0 && (
        <p className="text-neutral-400">Todavía no tenés rutinas, creá la primera.</p>
      )}

      <ul className="flex flex-col gap-2">
        {routines?.map((routine) => (
          <li key={routine.id}>
            <Link
              to={`/routines/${routine.id}`}
              className="block rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-neutral-700"
            >
              {routine.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
