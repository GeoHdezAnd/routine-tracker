import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email, password, name || undefined, birthDate || undefined);
      navigate("/routines");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ocurrió un error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-950 px-4 py-12 text-neutral-100">
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-base text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Contraseña
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-base text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nombre (opcional)
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-base text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fecha de nacimiento (opcional)
          <input
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-base text-neutral-100"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-neutral-100 px-4 py-2 font-medium text-neutral-950 disabled:opacity-50"
        >
          {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
      <p className="text-sm text-neutral-400">
        ¿Ya tenés cuenta?{" "}
        <Link to="/login" className="text-neutral-100 underline">
          Iniciá sesión
        </Link>
      </p>
    </main>
  );
}
