"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/cliente";
import { Alerta, Boton, Spinner, inputClase } from "@/components/ui";
import DetallePrestamo from "@/components/panel/DetallePrestamo";
import { SolicitudEnCurso, type Solicitud } from "@/components/panel/PanelEstudiante";
import { Estado, PROPOSITOS, Tarjeta, Vacio, usdc } from "@/components/panel/comunes";
import type { Usuario } from "@/lib/auth";

type Prestamo = { id: string; onchain_loan_id: number; status: string; principal: number; depositor_address: string };

export default function PanelGarante({ user }: { user: Usuario }) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[] | null>(null);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(
    () =>
      Promise.all([
        api<{ solicitudes: Solicitud[] }>("/api/applications"),
        api<{ prestamos: Prestamo[] }>("/api/loans/status"),
        api<{ saldoUsdc: number }>("/api/credit").catch(() => null),
      ]).then(
        ([s, p, c]) => {
          setSolicitudes(s.solicitudes);
          setPrestamos(p.prestamos);
          setSaldo(c?.saldoUsdc ?? null);
        },
        (e) => setError((e as Error).message),
      ),
    [],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!solicitudes) return error ? <Alerta tipo="error">{error}</Alerta> : <Spinner className="h-6 w-6 text-white0" />;

  const porDepositar = solicitudes.filter((s) => s.status === "approved");
  const activos = prestamos.filter((p) => p.status === "active");
  const cerrados = prestamos.filter((p) => p.status !== "active");
  const enRevision = solicitudes.filter((s) => s.status === "submitted");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Hola, {user.fullName?.split(" ")[0] ?? "garante"}</h1>
          <p className="mt-1 text-sm text-ink/60">
            Respaldas a estudiantes bloqueando USDC. Tu garantía vuelve a ti a medida que pagan.
          </p>
        </div>
        {saldo !== null && <span className="rounded-full bg-cream px-3 py-1 text-sm text-ink/70">Saldo: {usdc(saldo)}</span>}
      </div>

      <VincularEstudiante onListo={cargar} />

      {porDepositar.map((s) => (
        <SolicitudEnCurso key={s.id} s={s} wallet={user.wallet!} onCambio={cargar} soloDeposito />
      ))}

      {enRevision.length > 0 && (
        <Tarjeta titulo="Solicitudes en revisión">
          <ul className="divide-y divide-ink/10 text-sm">
            {enRevision.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-ink/80">
                  {s.student?.full_name} · {usdc(s.amount_usd)} · {PROPOSITOS[s.purpose]} · garantía {usdc(s.collateral_amount)}
                </span>
                <Estado status={s.status} />
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {activos.length === 0 && porDepositar.length === 0 && enRevision.length === 0 && (
        <Vacio>Aún no respaldas ningún préstamo activo.</Vacio>
      )}

      {activos.map((p) => (
        <DetallePrestamo key={p.id} loanId={p.onchain_loan_id} wallet={user.wallet!} onCambio={cargar} />
      ))}

      {cerrados.length > 0 && (
        <Tarjeta titulo="Préstamos finalizados que respaldaste">
          <ul className="divide-y divide-ink/10 text-sm">
            {cerrados.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-ink/80">
                  Préstamo #{p.onchain_loan_id} · {usdc(p.principal)}
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

function VincularEstudiante({ onListo }: { onListo: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState<{ tipo: "error" | "success"; t: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCargando(true);
    try {
      await api("/api/invitations/accept", { code: codigo });
      setMsg({ tipo: "success", t: "Listo: ahora respaldas a este estudiante." });
      setCodigo("");
      onListo();
    } catch (err) {
      setMsg({ tipo: "error", t: (err as Error).message });
    } finally {
      setCargando(false);
    }
  }

  return (
    <Tarjeta titulo="Respaldar a un estudiante">
      <form onSubmit={vincular} className="flex flex-wrap gap-2">
        <input
          aria-label="Código de invitación"
          placeholder="Código que te compartió el estudiante"
          className={`${inputClase} max-w-sm font-mono text-sm`}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.trim())}
          required
        />
        <Boton type="submit" variant="secondary" disabled={cargando}>
          {cargando && <Spinner />} Vincular
        </Boton>
      </form>
      {msg && (
        <div className="mt-3">
          <Alerta tipo={msg.tipo}>{msg.t}</Alerta>
        </div>
      )}
    </Tarjeta>
  );
}
