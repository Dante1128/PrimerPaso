// Piezas compartidas por los paneles — estilo NEO-BRUTALISTA.
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
    <section className={`nb-card p-5 sm:p-6 ${className}`}>
      {(titulo || accion) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {titulo && <h2 className="text-base font-bold text-ink">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Dato({
  label,
  valor,
  sub,
  destacado,
}: {
  label: string;
  valor: ReactNode;
  sub?: ReactNode;
  destacado?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink/50">{label}</p>
      <p className={`mt-1 font-bold ${destacado ? "text-2xl text-brandink" : "text-lg text-ink"}`}>
        {valor}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink/60">{sub}</p>}
    </div>
  );
}

export const usdc = (n: number | string | null | undefined, dec = 2) => `${fmt(Number(n ?? 0), dec)} USDC`;

const ESTADOS: Record<string, { txt: string; clase: string }> = {
  // préstamos
  active: { txt: "Activo", clase: "bg-brand/20" },
  repaid: { txt: "Pagado", clase: "bg-lime/30" },
  liquidated: { txt: "Cobrado de la garantía", clase: "bg-black/10" },
  defaulted: { txt: "En default", clase: "bg-coral/25" },
  // solicitudes
  submitted: { txt: "En revisión", clase: "bg-sun/40" },
  approved: { txt: "Aprobada", clase: "bg-brand/20" },
  rejected: { txt: "Rechazada", clase: "bg-coral/25" },
  opened: { txt: "Préstamo abierto", clase: "bg-lime/30" },
  cancelled: { txt: "Cancelada", clase: "bg-black/10" },
  draft: { txt: "Borrador", clase: "bg-black/10" },
  // KYC y cuotas
  pending: { txt: "Pendiente", clase: "bg-sun/40" },
  paid: { txt: "Pagada", clase: "bg-lime/30" },
  late: { txt: "Pagada con atraso", clase: "bg-sun/50" },
  accepted: { txt: "Aceptada", clase: "bg-lime/30" },
  mora: { txt: "En mora", clase: "bg-coral/25" },
};

export function Estado({ status }: { status: string }) {
  const e = ESTADOS[status] ?? { txt: status, clase: "bg-black/10" };
  return (
    <span className={`inline-block rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold text-ink ${e.clase}`}>
      {e.txt}
    </span>
  );
}

export function LinkTx({ hash, texto }: { hash?: string | null; texto?: string }) {
  if (!hash) return null;
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs font-bold text-brandink hover:underline"
    >
      {texto ?? "Comprobante"} ↗
    </a>
  );
}

export function Barra({ pct, color = "bg-brand" }: { pct: number; color?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-3.5 w-full overflow-hidden rounded-full border-2 border-ink bg-white">
      <div className={`h-full ${color} transition-all`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border-2 border-dashed border-ink/40 px-4 py-6 text-center text-sm font-medium text-ink/60">
      {children}
    </p>
  );
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
