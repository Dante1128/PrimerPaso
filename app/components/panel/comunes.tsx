// Piezas compartidas por los paneles.
import type { ReactNode } from "react";
import { fmt } from "@/lib/calculos";

export function Tarjeta({
  titulo,
  accion,
  children,
  className = "",
}: {
  titulo?: string;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`}>
      {(titulo || accion) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {titulo && <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Dato({ label, valor, sub, destacado }: { label: string; valor: ReactNode; sub?: ReactNode; destacado?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 font-semibold ${destacado ? "text-2xl text-teal-700" : "text-lg text-slate-900"}`}>{valor}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export const usdc = (n: number | string | null | undefined, dec = 2) => `${fmt(Number(n ?? 0), dec)} USDC`;

const ESTADOS: Record<string, { txt: string; clase: string }> = {
  // préstamos
  active: { txt: "Activo", clase: "bg-teal-50 text-teal-700" },
  repaid: { txt: "Pagado", clase: "bg-emerald-50 text-emerald-700" },
  liquidated: { txt: "Liquidado", clase: "bg-slate-100 text-slate-600" },
  defaulted: { txt: "En default", clase: "bg-rose-50 text-rose-600" },
  // solicitudes
  submitted: { txt: "En revisión", clase: "bg-amber-50 text-amber-700" },
  approved: { txt: "Aprobada", clase: "bg-teal-50 text-teal-700" },
  rejected: { txt: "Rechazada", clase: "bg-rose-50 text-rose-600" },
  opened: { txt: "Préstamo abierto", clase: "bg-emerald-50 text-emerald-700" },
  cancelled: { txt: "Cancelada", clase: "bg-slate-100 text-slate-500" },
  draft: { txt: "Borrador", clase: "bg-slate-100 text-slate-500" },
  // KYC y cuotas
  pending: { txt: "Pendiente", clase: "bg-amber-50 text-amber-700" },
  paid: { txt: "Pagada", clase: "bg-emerald-50 text-emerald-700" },
  late: { txt: "Pagada con atraso", clase: "bg-orange-50 text-orange-700" },
  accepted: { txt: "Aceptada", clase: "bg-emerald-50 text-emerald-700" },
  mora: { txt: "En mora", clase: "bg-rose-50 text-rose-600" },
};

export function Estado({ status }: { status: string }) {
  const e = ESTADOS[status] ?? { txt: status, clase: "bg-slate-100 text-slate-500" };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.clase}`}>{e.txt}</span>;
}

export function LinkTx({ hash, texto }: { hash?: string | null; texto?: string }) {
  if (!hash) return null;
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs text-teal-700 hover:underline"
    >
      {texto ?? `${hash.slice(0, 8)}…`} ↗
    </a>
  );
}

export function Barra({ pct, color = "from-teal-500 to-emerald-500" }: { pct: number; color?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

export const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" }) : "—";

export const PROPOSITOS: Record<string, string> = {
  tuition: "Matrícula",
  laptop: "Laptop",
  course: "Curso",
  materials: "Materiales",
  other: "Otro",
};
