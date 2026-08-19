import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg",
  secondary: "border border-border bg-transparent text-fg",
  danger: "border border-danger/30 bg-danger-soft text-danger",
  ghost: "bg-transparent text-fg-muted hover:bg-surface-muted",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`rounded-full px-4 py-2 font-medium transition-colors disabled:opacity-50 ${BUTTON_VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}

export function IconButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-surface-muted disabled:opacity-50 ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm ${className}`}>{children}</div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-border bg-surface px-3 py-2 text-base text-fg placeholder:text-fg-subtle ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-border bg-surface px-3 py-2 text-base text-fg ${props.className ?? ""}`}
    />
  );
}

export function FieldLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <label className={`flex flex-col gap-1 text-sm text-fg ${className}`}>{children}</label>;
}

export function Pill({
  active = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
        active ? "bg-accent text-accent-fg" : "bg-surface-muted text-fg-muted"
      } ${className}`}
    />
  );
}
