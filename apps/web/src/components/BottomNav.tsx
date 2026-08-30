import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { CalendarRange, Dumbbell, House, ListChecks, Menu, Settings, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const LINKS: { to: string; label: string; end: boolean; icon: LucideIcon }[] = [
  { to: "/", label: "Inicio", end: true, icon: House },
  { to: "/routines", label: "Rutinas", end: false, icon: CalendarRange },
  { to: "/exercises", label: "Ejercicios", end: false, icon: Dumbbell },
  { to: "/sessions", label: "Sesiones", end: false, icon: ListChecks },
  { to: "/settings", label: "Ajustes", end: false, icon: Settings },
];

export function BottomNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/20"
        />
      )}

      <div className="fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-3">
        <ul
          className={`flex flex-col items-end gap-2 transition-all duration-200 ${
            open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
          }`}
        >
          {LINKS.map(({ to, label, end, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-full border border-border bg-surface py-2 pr-4 pl-3 text-sm font-medium shadow-lg ${
                    isActive ? "text-accent" : "text-fg-subtle"
                  }`
                }
              >
                <Icon className="size-5" strokeWidth={2} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        <button
          type="button"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-xl transition-transform active:scale-95"
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>
    </>
  );
}
