import { NavLink } from "react-router";

const LINKS = [
  { to: "/routines", label: "Rutinas" },
  { to: "/exercises", label: "Ejercicios" },
  { to: "/sessions", label: "Sesiones" },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {LINKS.map((link) => (
          <li key={link.to} className="flex-1">
            <NavLink
              to={link.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-3 text-sm ${
                  isActive ? "text-neutral-100" : "text-neutral-500"
                }`
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
