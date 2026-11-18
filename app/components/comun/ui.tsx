// Primitivos de interfaz reutilizables — estilo "minimal fintech" (tema claro).
import { ReactNode } from "react";

export function Campo({
  label,
  htmlFor,
  error,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-semibold text-ink"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink/50">{hint}</p>}
      {error && <p className="mt-1 text-xs font-semibold text-coral">{error}</p>}
    </div>
  );
}

export const inputClase =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 font-medium text-ink placeholder:text-ink/40 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-black/5 disabled:text-ink/40";

export function Boton({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost" | "sun" | "coral";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
  const estilos = {
    primary: "bg-brand text-white nb-shadow-sm nb-press hover:bg-brandink",
    secondary: "border border-line bg-white text-ink nb-shadow-sm nb-press hover:bg-cream",
    sun: "bg-sun/90 text-ink nb-shadow-sm nb-press",
    coral: "bg-coral text-white nb-shadow-sm nb-press",
    ghost: "text-ink/70 hover:text-ink underline-offset-4 hover:underline",
  } as const;
  return (
    <button className={`${base} ${estilos[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Alerta({
  tipo = "info",
  children,
}: {
  tipo?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const estilos = {
    info: "bg-azure/10 text-azure",
    error: "bg-coral/10 text-coral",
    success: "bg-lime/10 text-lime",
  } as const;
  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm font-medium ${estilos[tipo]}`}
      role={tipo === "error" ? "alert" : undefined}
    >
      {children}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 00-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
}
