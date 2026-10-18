"use client";

import { useCallback, useEffect, useState } from "react";
import { api, firmarYEnviar } from "@/lib/cliente";
import { Alerta, Boton, Campo, Spinner, inputClase } from "@/components/ui";
import SimuladorPrestamo from "@/components/SimuladorPrestamo";
import DetallePrestamo from "@/components/panel/DetallePrestamo";
import TarjetaCredito, { type Credito } from "@/components/panel/TarjetaCredito";
import { Estado, PROPOSITOS, Tarjeta, fecha, usdc } from "@/components/panel/comunes";
import type { Usuario } from "@/lib/auth";

export type Solicitud = {
  id: string;
  purpose: string;
  purpose_detail: string | null;
  amount_usd: number;
  collateral_amount: number;
  installments: number;
  rate_bps: number;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  student?: { full_name: string | null } | null;
  guarantor?: { full_name: string | null } | null;
  garantiaDepositada?: boolean;
};

type Prestamo = { id: string; onchain_loan_id: number; status: string; principal: number; opened_at: string; closed_at: string | null };
type Invitacion = { code: string; guarantor_email: string; status: string; expires_at: string; guarantor: { full_name: string | null } | null };

export default function PanelEstudiante({ user }: { user: Usuario }) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[] | null>(null);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [credito, setCredito] = useState<Credito | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [s, p, c] = await Promise.all([
        api<{ solicitudes: Solicitud[] }>("/api/applications"),
        api<{ prestamos: Prestamo[] }>("/api/loans/status"),
        api<Credito>("/api/credit").catch(() => null),
      ]);
      setSolicitudes(s.solicitudes);
      setPrestamos(p.prestamos);
      setCredito(c);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!solicitudes) {
    return error ? <Alerta tipo="error">{error}</Alerta> : <Spinner className="h-6 w-6 text-white0" />;
  }

  const activos = prestamos.filter((p) => p.status === "active");
  const cerrados = prestamos.filter((p) => p.status !== "active");
  const enCurso = solicitudes.find((s) => ["submitted", "approved"].includes(s.status));
  const ultimaRechazada = solicitudes.find((s) => s.status === "rejected");

  return (
    <div className="space-y-6">
      <Encabezado user={user} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TarjetaCredito credito={credito} wallet={user.wallet!} />
        </div>
        <InvitarGarante />
      </div>

      {activos.map((p) => (
        <DetallePrestamo key={p.id} loanId={p.onchain_loan_id} wallet={user.wallet!} onCambio={cargar} />
      ))}

      {activos.length === 0 && enCurso && <SolicitudEnCurso s={enCurso} wallet={user.wallet!} onCambio={cargar} />}

      {activos.length === 0 && !enCurso && (
        <NuevaSolicitud kycStatus={user.kycStatus} rechazada={ultimaRechazada} onCreada={cargar} />
      )}

      {cerrados.length > 0 && (
        <Tarjeta titulo="Historial de préstamos">
          <ul className="divide-y divide-ink/10 text-sm">
            {cerrados.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-ink/80">
                  Préstamo #{p.onchain_loan_id} · {usdc(p.principal)} · {fecha(p.opened_at)}
                </span>
                <Estado status={p.status} />
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}

function Encabezado({ user }: { user: Usuario }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-ink">Hola, {user.fullName?.split(" ")[0] ?? "estudiante"}</h1>
        <p className="mt-1 text-sm text-ink/60">
          {user.estudiante?.university_name} · {user.estudiante?.career}
          {user.estudiante?.semester ? ` · ${user.estudiante.semester}º semestre` : ""}
        </p>
      </div>
      {user.kycStatus !== "approved" && (
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          {user.kycStatus === "rejected" ? "Identidad rechazada" : "Identidad en revisión"}
        </span>
      )}
    </div>
  );
}

/* -------- Nueva solicitud: simulador + datos -------- */
function NuevaSolicitud({
  kycStatus,
  rechazada,
  onCreada,
}: {
  kycStatus: string | null;
  rechazada?: Solicitud;
  onCreada: () => void;
}) {
  const [elegido, setElegido] = useState<{ monto: number; cuotas: number } | null>(null);
  const [purpose, setPurpose] = useState("tuition");
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!elegido) return;
    setError("");
    setEnviando(true);
    try {
      await api("/api/applications", {
        amountUsd: elegido.monto,
        installments: elegido.cuotas,
        purpose,
        purposeDetail: detalle || undefined,
      });
      onCreada();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      {rechazada && (
        <Alerta tipo="info">
          Tu solicitud anterior fue rechazada{rechazada.rejection_reason ? `: ${rechazada.rejection_reason}` : "."} Puedes
          enviar una nueva.
        </Alerta>
      )}
      {kycStatus === "pending" && (
        <Alerta tipo="info">Puedes enviar tu solicitud; se aprobará cuando un operador verifique tu identidad.</Alerta>
      )}

      <Tarjeta titulo="Simula y solicita tu préstamo">
        <SimuladorPrestamo onUsar={(monto, cuotas) => setElegido({ monto, cuotas })} textoUsar="Quiero este préstamo" />
      </Tarjeta>

      {elegido && (
        <Tarjeta titulo={`Solicitud: ${usdc(elegido.monto)} en ${elegido.cuotas} cuotas`}>
          <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
            <Campo label="¿Para qué es?" htmlFor="purpose">
              <select id="purpose" className={inputClase} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {Object.entries(PROPOSITOS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Detalle (opcional)" htmlFor="detalle">
              <input id="detalle" className={inputClase} value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={300} />
            </Campo>
            {error && (
              <div className="sm:col-span-2">
                <Alerta tipo="error">{error}</Alerta>
              </div>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Boton type="submit" disabled={enviando}>
                {enviando && <Spinner />} Enviar solicitud
              </Boton>
              <Boton type="button" variant="secondary" onClick={() => setElegido(null)}>
                Cambiar monto
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}
    </div>
  );
}

/* -------- Solicitud en revisión / aprobada (depósito y firma) -------- */
export function SolicitudEnCurso({
  s,
  wallet,
  onCambio,
  soloDeposito,
}: {
  s: Solicitud;
  wallet: string;
  onCambio: () => void;
  soloDeposito?: boolean;
}) {
  const [cargando, setCargando] = useState<"" | "deposit" | "open">("");
  const [error, setError] = useState("");
  const [link, setLink] = useState("");

  async function paso(step: "deposit" | "open") {
    setError("");
    setLink("");
    setCargando(step);
    try {
      const r = await firmarYEnviar(wallet, "/api/loans/prepare", "/api/loans/submit", { applicationId: s.id, step });
      setLink(String(r.link ?? ""));
      onCambio();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando("");
    }
  }

  return (
    <Tarjeta
      titulo={`${soloDeposito ? `${s.student?.full_name ?? "Estudiante"}: ` : ""}${usdc(s.amount_usd)} en ${s.installments} cuotas · ${PROPOSITOS[s.purpose] ?? s.purpose}`}
      accion={<Estado status={s.status} />}
    >
      {s.status === "submitted" && (
        <p className="text-sm text-ink/70">
          Un operador está revisando la solicitud. Garantía necesaria: <strong>{usdc(s.collateral_amount)}</strong>
          {s.guarantor?.full_name ? `, que puede aportar ${s.guarantor.full_name} (garante)` : ""}.
        </p>
      )}

      {s.status === "approved" && (
        <ol className="space-y-3">
          <Paso
            n={1}
            hecho={!!s.garantiaDepositada}
            titulo={`Bloquear la garantía: ${usdc(s.collateral_amount)}`}
            desc={
              soloDeposito
                ? "La bloqueas tú desde tu wallet. Se te devuelve a medida que el estudiante paga."
                : s.guarantor?.full_name
                  ? `La puedes bloquear tú o ${s.guarantor.full_name} desde su panel de garante.`
                  : "Se bloquea en el contrato y se te devuelve a medida que pagas."
            }
          >
            {!s.garantiaDepositada && (
              <Boton onClick={() => paso("deposit")} disabled={!!cargando}>
                {cargando === "deposit" && <Spinner />} Bloquear con Freighter
              </Boton>
            )}
          </Paso>
          {!soloDeposito && (
            <Paso
              n={2}
              hecho={false}
              titulo="Firmar el préstamo y recibir el dinero"
              desc={`Recibes ${usdc(Number(s.amount_usd) * 0.99)} (monto menos la comisión del 1%). PrimerPaso co-firma la apertura.`}
            >
              <Boton onClick={() => paso("open")} disabled={!s.garantiaDepositada || !!cargando}>
                {cargando === "open" && <Spinner />} Firmar y recibir
              </Boton>
            </Paso>
          )}
        </ol>
      )}

      {error && <div className="mt-4"><Alerta tipo="error">{error}</Alerta></div>}
      {link && (
        <div className="mt-4">
          <Alerta tipo="success">
            Listo, registrado on-chain.{" "}
            <a href={link} target="_blank" rel="noreferrer" className="font-semibold underline">
              Ver en stellar.expert
            </a>
          </Alerta>
        </div>
      )}
    </Tarjeta>
  );
}

function Paso({ n, hecho, titulo, desc, children }: { n: number; hecho: boolean; titulo: string; desc: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ink p-4">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
            hecho ? "bg-lime/300 text-white" : "bg-cream text-ink/70"
          }`}
        >
          {hecho ? "✓" : n}
        </span>
        <div>
          <p className="font-medium text-ink">{titulo}</p>
          <p className="text-sm text-ink/60">{desc}</p>
        </div>
      </div>
      {children}
    </li>
  );
}

/* -------- Invitar garante -------- */
function InvitarGarante() {
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(() => {
    api<{ invitaciones: Invitacion[] }>("/api/invitations").then((d) => setInvitaciones(d.invitaciones)).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const d = await api<{ code: string }>("/api/invitations", { guarantorEmail: email });
      setCodigo(d.code);
      setEmail("");
      cargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const aceptado = invitaciones.find((i) => i.status === "accepted");

  return (
    <Tarjeta titulo="Tu garante">
      {aceptado ? (
        <p className="text-sm text-ink/70">
          <strong className="text-ink">{aceptado.guarantor?.full_name ?? aceptado.guarantor_email}</strong> respalda tus
          préstamos y puede bloquear la garantía por ti.
        </p>
      ) : (
        <p className="text-sm text-ink/60">Un familiar puede bloquear la garantía por ti. Invítalo:</p>
      )}
      <form onSubmit={invitar} className="mt-3 flex gap-2">
        <input
          type="email"
          aria-label="Email del garante"
          placeholder="email@familia.com"
          className={`${inputClase} py-2 text-sm`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Boton type="submit" variant="secondary" className="shrink-0 px-4">
          Invitar
        </Boton>
      </form>
      {error && <p className="mt-2 text-xs text-coral">{error}</p>}
      {codigo && (
        <div className="mt-3 rounded-xl border border-dashed border-ink bg-brand/15 p-3 text-center">
          <p className="text-xs text-brandink">Comparte este código con tu garante:</p>
          <p className="font-mono text-lg font-bold tracking-wider text-brandink">{codigo}</p>
        </div>
      )}
      {invitaciones.filter((i) => i.status === "pending").length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink/60">
          {invitaciones
            .filter((i) => i.status === "pending")
            .map((i) => (
              <li key={i.code}>
                {i.guarantor_email} · código <span className="font-mono">{i.code}</span> · vence {fecha(i.expires_at)}
              </li>
            ))}
        </ul>
      )}
    </Tarjeta>
  );
}

