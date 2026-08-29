import { NavLink } from "react-router";
import { CalendarRange, Dumbbell, House, ListChecks, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const LINKS: { to: string; label: string; end: boolean; icon: LucideIcon }[] = [
  { to: "/", label: "Inicio", end: true, icon: House },
  { to: "/routines", label: "Rutinas", end: false, icon: CalendarRange },
  { to: "/exercises", label: "Ejercicios", end: false, icon: Dumbbell },
  { to: "/sessions", label: "Sesiones", end: false, icon: ListChecks },
  { to: "/settings", label: "Ajustes", end: false, icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {LINKS.map(({ to, label, end, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                  isActive ? "text-accent" : "text-fg-subtle"
                }`
              }
            >
              <Icon className="size-6" strokeWidth={2} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
