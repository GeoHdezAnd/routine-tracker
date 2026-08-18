import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-neutral-100 text-neutral-950",
  secondary: "border border-neutral-700 bg-transparent text-neutral-100",
  danger: "bg-red-500/10 text-red-400 border border-red-500/30",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`rounded-md px-4 py-2 font-medium disabled:opacity-50 ${BUTTON_VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3 ${className}`}>{children}</div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-base text-neutral-100 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-base text-neutral-100 ${props.className ?? ""}`}
    />
  );
}

export function FieldLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <label className={`flex flex-col gap-1 text-sm ${className}`}>{children}</label>;
}
