import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import { Button, FieldLabel, Input } from "../../components/ui";

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-4 py-12 text-fg">
      <h1 className="text-2xl font-bold">Crear cuenta</h1>
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <FieldLabel>
          Email
          <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </FieldLabel>
        <FieldLabel>
          Contraseña
          <Input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FieldLabel>
        <FieldLabel>
          Nombre (opcional)
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </FieldLabel>
        <FieldLabel>
          Fecha de nacimiento (opcional)
          <Input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
        </FieldLabel>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="py-3">
          {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>
      <p className="text-sm text-fg-muted">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="font-medium text-accent">
          Inicia sesión
        </Link>
      </p>
    </main>
  );
}
