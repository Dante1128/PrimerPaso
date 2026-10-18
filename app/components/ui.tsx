// Primitivos de interfaz reutilizables — estilo NEO-BRUTALISTA (tema claro).
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
        className="mb-1.5 block text-sm font-bold text-ink"
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
  "w-full rounded-xl border-2 border-ink bg-white px-3 py-2.5 font-medium text-ink placeholder:text-ink/40 outline-none transition focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[3px_3px_0_0_#141414] disabled:bg-black/5 disabled:text-ink/40";

export function Boton({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost" | "sun" | "coral";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60";
  const estilos = {
    primary: "border-2 border-ink bg-brand text-white nb-shadow nb-press",
    secondary: "border-2 border-ink bg-white text-ink nb-shadow nb-press",
    sun: "border-2 border-ink bg-sun text-ink nb-shadow nb-press",
    coral: "border-2 border-ink bg-coral text-white nb-shadow nb-press",
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
    info: "bg-azure/20 text-ink",
    error: "bg-coral/20 text-ink",
    success: "bg-lime/25 text-ink",
  } as const;
  return (
    <div
      className={`rounded-xl border-2 border-ink px-4 py-3 text-sm font-medium nb-shadow-sm ${estilos[tipo]}`}
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
