"use client";
// Piezas compartidas por los paneles — estilo "minimal fintech".
import { useState, type ReactNode } from "react";
import { fmt } from "@/lib/creditos/calculos";
import { copiar } from "@/lib/comun/cliente";
import { cortarDir } from "@/lib/comun/format";

/** Esqueleto de carga del panel: la silueta del dashboard, no un spinner suelto. */
export function EsqueletoPanel() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="h-7 w-48 rounded-lg bg-ink/10" />
      <div className="h-36 rounded-3xl bg-ink/10 sm:h-40" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-40 rounded-2xl bg-ink/10 lg:col-span-2" />
        <div className="h-40 rounded-2xl bg-ink/10" />
      </div>
    </div>
  );
}

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

const ICONOS_MOVIMIENTO = {
  entra: { clase: "bg-lime/15 text-lime", path: "M12 19V5m0 0l-6 6m6-6l6 6" },
  sale: { clase: "bg-brand/15 text-brandink", path: "M12 5v14m0 0l-6-6m6 6l6-6" },
  alerta: {
    clase: "bg-coral/15 text-coral",
    path: "M12 9v4m0 4h.01M10.3 3.9l-8 14A1.5 1.5 0 003.6 20h16.8a1.5 1.5 0 001.3-2.1l-8-14a1.5 1.5 0 00-2.6 0z",
  },
} as const;

/** Icono redondo para un ítem de movimiento: dinero que entra, que sale, o una alerta. */
export function IconoMovimiento({ tipo }: { tipo: keyof typeof ICONOS_MOVIMIENTO }) {
  const { clase, path } = ICONOS_MOVIMIENTO[tipo];
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${clase}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d={path} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * Tarjeta de saldo, al estilo de una app de wallet: el número protagonista
 * de la pantalla. Va primero en el panel, antes que cualquier otra sección.
 */
export function SaldoHero({
  saldo,
  puntaje,
  wallet,
  children,
}: {
  /** USDC en la wallet; null mientras carga. */
  saldo: number | null;
  /** Puntaje crediticio (300-850), opcional. */
  puntaje?: number | null;
  /** Dirección de la wallet, para poder copiarla (recibir fondos). */
  wallet?: string | null;
  /** Acciones rápidas o aviso corto, debajo del saldo. */
  children?: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-brand to-brandink p-6 text-white nb-shadow-lg sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/75">Tu saldo</p>
          <p className="mt-1 break-all text-3xl font-bold tracking-tight sm:text-5xl">
            {saldo === null ? "…" : usdc(saldo, 2)}
          </p>
          {wallet && <CopiarWallet wallet={wallet} />}
        </div>
        {puntaje != null && (
          <div className="shrink-0 rounded-2xl bg-white/15 px-4 py-2 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/70">Puntaje</p>
            <p className="text-xl font-bold">{puntaje}</p>
          </div>
        )}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

/** Chip para copiar la dirección de la wallet (recibir fondos a esa cuenta). */
function CopiarWallet({ wallet }: { wallet: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setCopiado(await copiar(wallet));
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/25"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" stroke="currentColor" strokeWidth="2" />
      </svg>
      {copiado ? "Copiada" : cortarDir(wallet)}
    </button>
  );
}

const ESTADOS: Record<string, { txt: string; clase: string }> = {
  // préstamos
  active: { txt: "Activo", clase: "bg-brand/10 text-brandink" },
  repaid: { txt: "Pagado", clase: "bg-lime/10 text-lime" },
  liquidated: { txt: "Cobrado de la garantía", clase: "bg-ink/5 text-ink/60" },
  defaulted: { txt: "En default", clase: "bg-coral/10 text-coral" },
  // solicitudes
  submitted: { txt: "En revisión", clase: "bg-sun/15 text-sun" },
  approved: { txt: "Aprobada", clase: "bg-brand/10 text-brandink" },
  rejected: { txt: "Rechazada", clase: "bg-coral/10 text-coral" },
  opened: { txt: "Préstamo abierto", clase: "bg-lime/10 text-lime" },
  cancelled: { txt: "Cancelada", clase: "bg-ink/5 text-ink/60" },
  draft: { txt: "Borrador", clase: "bg-ink/5 text-ink/60" },
  // KYC y cuotas
  pending: { txt: "Pendiente", clase: "bg-sun/15 text-sun" },
  paid: { txt: "Pagada", clase: "bg-lime/10 text-lime" },
  late: { txt: "Pagada con atraso", clase: "bg-sun/15 text-sun" },
  accepted: { txt: "Aceptada", clase: "bg-lime/10 text-lime" },
  mora: { txt: "En mora", clase: "bg-coral/10 text-coral" },
};

export function Estado({ status }: { status: string }) {
  const e = ESTADOS[status] ?? { txt: status, clase: "bg-ink/5 text-ink/60" };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.clase}`}>
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
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink/5">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm font-medium text-ink/60">
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
