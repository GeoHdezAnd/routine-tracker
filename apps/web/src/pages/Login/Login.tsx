import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import { Button, FieldLabel, Input, PasswordInput } from "../../components/ui";

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
      navigate("/");
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
          <PasswordInput
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
        <Button type="submit" loading={isSubmitting} className="py-3">
          Ingresar
        </Button>
        <p className="text-center text-xs text-fg-muted">
          Si ves un error o la app no responde, recargá la página y volvé a intentar: el servidor puede tardar unos segundos en despertar.
        </p>
      </form>
    </main>
  );
}
