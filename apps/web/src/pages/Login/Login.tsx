import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import { Button, FieldLabel, Input } from "../../components/ui";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/routines");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ocurrió un error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-4 py-12 text-fg">
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FieldLabel>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="py-3">
          {isSubmitting ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>
      <p className="text-sm text-fg-muted">
        ¿No tienes cuenta?{" "}
        <Link to="/register" className="font-medium text-accent">
          Regístrate
        </Link>
      </p>
    </main>
  );
}
