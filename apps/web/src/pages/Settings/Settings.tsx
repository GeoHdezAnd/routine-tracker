import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Moon, Pencil, Sun } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import type { CurrentUser } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { apiFetch, ApiError } from "../../lib/api";
import { kgToDisplay, displayToKg, unitLabel } from "../../lib/units";
import { Button, Card, FieldLabel, IconButton, Input } from "../../components/ui";

type UpdateProfilePayload = {
  name?: string;
  birthDate?: string;
  bodyWeightKg?: number;
};

export function SettingsPage() {
  const { user, token, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  const unit = user?.unitPreference ?? "KG";

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [weight, setWeight] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setBirthDate(user.birthDate ? user.birthDate.slice(0, 10) : "");
    setWeight(user.bodyWeightKg != null ? String(kgToDisplay(user.bodyWeightKg, unit)) : "");
  }, [user?.id, unit]);

  function startEditingProfile() {
    if (!user) return;
    setName(user.name ?? "");
    setBirthDate(user.birthDate ? user.birthDate.slice(0, 10) : "");
    setWeight(user.bodyWeightKg != null ? String(kgToDisplay(user.bodyWeightKg, unit)) : "");
    setProfileError(null);
    setIsEditingProfile(true);
  }

  const setUnitPreference = useMutation({
    mutationFn: (unitPreference: "KG" | "LB") =>
      apiFetch<CurrentUser>("/auth/me", { method: "PATCH", token, body: { unitPreference } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", token] }),
  });

  const updateProfile = useMutation({
    mutationFn: (payload: UpdateProfilePayload) =>
      apiFetch<CurrentUser>("/auth/me", { method: "PATCH", token, body: payload }),
    onSuccess: () => {
      setProfileError(null);
      setIsEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ["me", token] });
    },
    onError: (error: unknown) => {
      setProfileError(error instanceof ApiError ? error.message : "Ocurrió un error inesperado");
    },
  });

  function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const parsedWeight = weight.trim() ? Number(weight) : null;

    updateProfile.mutate({
      name: trimmedName || undefined,
      birthDate: birthDate || undefined,
      bodyWeightKg: parsedWeight && parsedWeight > 0 ? displayToKg(parsedWeight, unit) : undefined,
    });
  }

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
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Información personal</h2>
          {!isEditingProfile && (
            <IconButton aria-label="Editar información personal" className="size-7" onClick={startEditingProfile}>
              <Pencil className="size-3.5" />
            </IconButton>
          )}
        </div>
        <Card>
          {isEditingProfile ? (
            <form onSubmit={handleProfileSubmit} className="flex flex-col gap-3 p-1">
              <FieldLabel>
                Nombre
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" />
              </FieldLabel>
              <FieldLabel>
                Fecha de nacimiento
                <Input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
              </FieldLabel>
              <FieldLabel>
                Peso corporal ({unitLabel(unit)})
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  placeholder={`Peso en ${unitLabel(unit)}`}
                />
              </FieldLabel>
              {profileError && (
                <p role="alert" className="text-sm text-danger">
                  {profileError}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" loading={updateProfile.isPending} className="flex-1">
                  Guardar cambios
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={updateProfile.isPending}
                  onClick={() => setIsEditingProfile(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <dl className="flex flex-col divide-y divide-border p-1">
              <div className="flex items-center justify-between py-2">
                <dt className="text-sm text-fg-muted">Nombre</dt>
                <dd className="truncate font-medium">{user?.name ?? "Sin especificar"}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-sm text-fg-muted">Fecha de nacimiento</dt>
                <dd className="font-medium">
                  {user?.birthDate
                    ? `${new Date(user.birthDate).toLocaleDateString()}${
                        user.age !== null ? ` (${user.age} años)` : ""
                      }`
                    : "Sin especificar"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-sm text-fg-muted">Peso corporal</dt>
                <dd className="font-medium">
                  {user?.bodyWeightKg != null
                    ? `${kgToDisplay(user.bodyWeightKg, unit)} ${unitLabel(unit)}`
                    : "Sin especificar"}
                </dd>
              </div>
            </dl>
          )}
        </Card>
      </section>

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
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              user?.unitPreference === "KG" ? "bg-accent text-accent-fg" : "text-fg-muted"
            }`}
          >
            {setUnitPreference.isPending && setUnitPreference.variables === "KG" && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            Kilogramos
          </button>
          <button
            type="button"
            onClick={() => setUnitPreference.mutate("LB")}
            disabled={setUnitPreference.isPending}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              user?.unitPreference === "LB" ? "bg-accent text-accent-fg" : "text-fg-muted"
            }`}
          >
            {setUnitPreference.isPending && setUnitPreference.variables === "LB" && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
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
