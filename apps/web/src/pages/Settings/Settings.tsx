import { Moon, Sun } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import type { CurrentUser } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { apiFetch } from "../../lib/api";
import { Button, Card } from "../../components/ui";

export function SettingsPage() {
  const { user, token, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  const setUnitPreference = useMutation({
    mutationFn: (unitPreference: "KG" | "LB") =>
      apiFetch<CurrentUser>("/auth/me", { method: "PATCH", token, body: { unitPreference } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", token] }),
  });

  const initials = (user?.name ?? user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-canvas px-4 pt-4 pb-24 text-fg">
      <h1 className="text-3xl font-bold">Configuración</h1>

      <Card className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-fg">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{user?.name ?? "Sin nombre"}</p>
          <p className="truncate text-sm text-fg-muted">{user?.email}</p>
        </div>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">Apariencia</h2>
        <Card className="flex gap-2 p-1.5">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
              theme === "light" ? "bg-accent text-accent-fg" : "text-fg-muted"
            }`}
          >
            <Sun className="size-4" />
            Claro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
              theme === "dark" ? "bg-accent text-accent-fg" : "text-fg-muted"
            }`}
          >
            <Moon className="size-4" />
            Oscuro
          </button>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">Unidad de peso</h2>
        <Card className="flex gap-2 p-1.5">
          <button
            type="button"
            onClick={() => setUnitPreference.mutate("KG")}
            disabled={setUnitPreference.isPending}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
              user?.unitPreference === "KG" ? "bg-accent text-accent-fg" : "text-fg-muted"
            }`}
          >
            Kilogramos
          </button>
          <button
            type="button"
            onClick={() => setUnitPreference.mutate("LB")}
            disabled={setUnitPreference.isPending}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
              user?.unitPreference === "LB" ? "bg-accent text-accent-fg" : "text-fg-muted"
            }`}
          >
            Libras
          </button>
        </Card>
      </section>

      <Button variant="danger" onClick={logout} className="mt-auto">
        Cerrar sesión
      </Button>
    </main>
  );
}
