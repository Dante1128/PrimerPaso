// Primitivos de interfaz reutilizables (tema claro).
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
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export const inputClase =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-400";

export function Boton({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
  const estilos = {
    primary: "bg-teal-600 text-white shadow-sm hover:bg-teal-700",
    secondary:
      "border border-slate-300 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-700",
    ghost: "text-slate-600 hover:text-teal-700",
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
    info: "border-sky-200 bg-sky-50 text-sky-800",
    error: "border-rose-200 bg-rose-50 text-rose-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  } as const;
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${estilos[tipo]}`}
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
