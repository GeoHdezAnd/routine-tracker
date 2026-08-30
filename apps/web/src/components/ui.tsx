import { Children, isValidElement, useEffect, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  OptionHTMLAttributes,
  ReactElement,
  ReactNode,
  RefObject,
} from "react";
import { Check, ChevronDown, Eye, EyeOff, Loader2, MoreVertical } from "lucide-react";

function useDropdownRect(
  open: boolean,
  onClose: () => void,
  triggerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);

    function isInside(target: EventTarget | null) {
      const node = target as Node | null;
      return !!node && (triggerRef.current?.contains(node) || contentRef.current?.contains(node));
    }

    function handlePointerDown(event: MouseEvent) {
      if (!isInside(event.target)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function handleScroll(event: Event) {
      if (!isInside(event.target)) onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, onClose, triggerRef]);

  return rect;
}

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
  loading = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium transition-colors disabled:opacity-50 ${BUTTON_VARIANT_CLASSES[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-4 shrink-0 animate-spin" />}
      {children}
    </button>
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
    <div className={`rounded-2xl border border-border bg-surface px-2 py-2 shadow-sm ${className}`}>{children}</div>
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

export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`w-full rounded-xl border border-border bg-surface px-3 py-2 pr-10 text-base text-fg placeholder:text-fg-subtle ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-fg-muted hover:text-fg"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

type SelectOption = ReactElement<OptionHTMLAttributes<HTMLOptionElement>>;

export function Select({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLUListElement>(null);
  const rect = useDropdownRect(open, () => setOpen(false), triggerRef, contentRef);

  const options = Children.toArray(children).filter(
    (child): child is SelectOption => isValidElement(child) && child.type === "option",
  );
  const selected = options.find((option) => option.props.value === value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-left text-base text-fg ${className}`}
      >
        <span className="truncate">{selected?.props.children ?? ""}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && rect && (
        <ul
          ref={contentRef}
          style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}
          className="fixed z-50 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {options.map((option) => (
            <li key={option.props.value as string}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.props.value as string);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                  option.props.value === value ? "font-medium text-accent" : "text-fg"
                }`}
              >
                <span className="truncate">{option.props.children}</span>
                {option.props.value === value && <Check className="size-4 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

type MenuAction = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
};

export function Menu({ items, className = "" }: { items: MenuAction[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLUListElement>(null);
  const rect = useDropdownRect(open, () => setOpen(false), triggerRef, contentRef);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Más opciones"
        onClick={() => setOpen((current) => !current)}
        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-muted ${className}`}
      >
        <MoreVertical className="size-4" />
      </button>

      {open && rect && (
        <ul
          ref={contentRef}
          style={{ top: rect.bottom + 4, right: window.innerWidth - rect.right }}
          className="fixed z-50 min-w-36 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {items.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm whitespace-nowrap disabled:opacity-50 ${
                  item.variant === "danger" ? "text-danger" : "text-fg"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
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
