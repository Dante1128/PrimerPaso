"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/cliente";
import { Alerta, Boton, Campo, Spinner, inputClase } from "@/components/ui";
import { RevisionKyc, RevisionSolicitudes } from "@/components/panel/PanelOperador";
import { Dato, Estado, LinkTx, Tarjeta, Vacio, fecha, usdc } from "@/components/panel/comunes";

const PESTANAS = [
  { id: "resumen", txt: "Pool e ingresos" },
  { id: "mora", txt: "Mora y liquidación" },
  { id: "parametros", txt: "Parámetros" },
  { id: "kyc", txt: "KYC" },
  { id: "solicitudes", txt: "Solicitudes" },
] as const;
type Pestana = (typeof PESTANAS)[number]["id"];

export default function PanelAdmin({ nombre }: { nombre: string }) {
  const [tab, setTab] = useState<Pestana>("resumen");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administración</h1>
        <p className="mt-1 text-sm text-slate-500">Hola, {nombre.split(" ")[0]}. Todo el dinero vive on-chain; aquí ves la caché del indexador y la cadena en vivo.</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-full bg-slate-100 p-1 text-sm font-semibold">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setTab(p.id)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 transition ${tab === p.id ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {p.txt}
          </button>
        ))}
      </nav>
      {tab === "resumen" && <Resumen />}
      {tab === "mora" && <Mora />}
      {tab === "parametros" && <Parametros />}
      {tab === "kyc" && <RevisionKyc />}
      {tab === "solicitudes" && <RevisionSolicitudes />}
    </div>
  );
}

/* ---------------- Pool e ingresos ---------------- */
type Overview = {
  pool: { treasury: string; saldoTreasury: number; disponibleParaPrestar: number; capitalDisponibleCache: number };
  ingresos: { total: number; interes: number; originacion: number; recargos: number; porMes: { month: string; type: string; total_usd: number }[] };
  cartera: { activos: number; pagados: number; liquidados: number; capitalPrestado: number; saldoPorCobrar: number };
  movimientos: { id: string; type: string; amount: number; tx_hash: string | null; note: string | null; created_at: string }[];
};

const MOVIMIENTO: Record<string, string> = { fund: "Fondeo", withdraw: "Retiro", disburse: "Desembolso", repay_principal: "Capital recuperado" };
const INGRESO: Record<string, string> = { interest: "Interés", origination: "Comisión de apertura", late_fee: "Recargo por mora", yield_share: "Rendimiento" };

function Resumen() {
  const [d, setD] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [sync, setSync] = useState("");

  const cargar = useCallback(() => {
    api<Overview>("/api/admin/overview").then(setD).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) return <Alerta tipo="error">{error}</Alerta>;
  if (!d) return <Spinner className="h-6 w-6 text-teal-500" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Tarjeta titulo="Pool (on-chain)">
          <div className="space-y-4">
            <Dato label="Disponible para prestar" valor={usdc(d.pool.disponibleParaPrestar)} destacado sub="mín. entre saldo y allowance de la treasury" />
            <Dato label="Saldo de la treasury" valor={usdc(d.pool.saldoTreasury)} />
            <a
              href={`https://stellar.expert/explorer/testnet/account/${d.pool.treasury}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              Treasury en stellar.expert ↗
            </a>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Ingresos de la plataforma">
          <div className="space-y-3">
            <Dato label="Total" valor={usdc(d.ingresos.total)} destacado />
            <div className="space-y-1 text-sm">
              <p className="flex justify-between"><span className="text-slate-500">Interés</span><strong>{usdc(d.ingresos.interes)}</strong></p>
              <p className="flex justify-between"><span className="text-slate-500">Comisiones de apertura</span><strong>{usdc(d.ingresos.originacion)}</strong></p>
              <p className="flex justify-between"><span className="text-slate-500">Recargos por mora</span><strong>{usdc(d.ingresos.recargos)}</strong></p>
            </div>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Cartera">
          <div className="space-y-3">
            <Dato label="Saldo por cobrar" valor={usdc(d.cartera.saldoPorCobrar)} destacado sub={`${d.cartera.activos} préstamo(s) activo(s)`} />
            <div className="space-y-1 text-sm">
              <p className="flex justify-between"><span className="text-slate-500">Capital prestado (histórico)</span><strong>{usdc(d.cartera.capitalPrestado)}</strong></p>
              <p className="flex justify-between"><span className="text-slate-500">Pagados</span><strong>{d.cartera.pagados}</strong></p>
              <p className="flex justify-between"><span className="text-slate-500">Liquidados</span><strong>{d.cartera.liquidados}</strong></p>
            </div>
          </div>
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Ingresos por mes">
          {d.ingresos.porMes.length === 0 ? (
            <Vacio>Sin ingresos todavía.</Vacio>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {d.ingresos.porMes.map((r) => (
                  <tr key={`${r.month}-${r.type}`}>
                    <td className="py-2 text-slate-500">{new Date(r.month).toLocaleDateString("es-BO", { month: "long", year: "numeric" })}</td>
                    <td className="py-2 text-slate-700">{INGRESO[r.type] ?? r.type}</td>
                    <td className="py-2 text-right font-semibold">{usdc(r.total_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Tarjeta>
        <Tarjeta
          titulo="Movimientos del pool"
          accion={
            <Boton
              variant="ghost"
              onClick={async () => {
                setSync("…");
                try {
                  await api("/api/admin/sync", {});
                  setSync("✓");
                  cargar();
                } catch (e) {
                  setSync((e as Error).message);
                }
              }}
            >
              Sincronizar {sync}
            </Boton>
          }
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {d.movimientos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">
                    {MOVIMIENTO[m.type] ?? m.type} · {usdc(m.amount)}
                  </p>
                  <p className="text-xs text-slate-500">{m.note ?? fecha(m.created_at)}</p>
                </div>
                <LinkTx hash={m.tx_hash} />
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </div>
  );
}

/* ---------------- Mora y liquidación ---------------- */
type EnCartera = {
  id: string;
  onchain_loan_id: number;
  principal: number;
  outstanding: number;
  collateral_locked: number;
  enMora: boolean;
  liquidable: boolean;
  vence: string | null;
  vencido: number;
  recargo: number;
  student: { full_name: string | null } | null;
};

function Mora() {
  const [lista, setLista] = useState<EnCartera[] | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState<{ id: number; link?: string } | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const cargar = useCallback(() => {
    api<{ prestamos: EnCartera[] }>("/api/liquidations").then((d) => setLista(d.prestamos)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function liquidar(id: number) {
    if (!window.confirm(`¿Liquidar el préstamo #${id}? Se cobra la deuda de la garantía y el resto vuelve al depositante.`)) return;
    setError("");
    setOcupado(id);
    try {
      const r = await api<{ link?: string }>("/api/liquidations", { loanId: id });
      setOk({ id, link: r.link });
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Tarjeta titulo="Préstamos activos" accion={<Boton variant="ghost" onClick={cargar}>Actualizar</Boton>}>
      {error && <Alerta tipo="error">{error}</Alerta>}
      {ok && (
        <div className="mb-3">
          <Alerta tipo="success">
            Préstamo #{ok.id} liquidado on-chain.{" "}
            {ok.link && (
              <a href={ok.link} target="_blank" rel="noreferrer" className="font-semibold underline">
                Ver en stellar.expert
              </a>
            )}
          </Alerta>
        </div>
      )}
      {!lista ? (
        <Spinner className="h-5 w-5 text-teal-500" />
      ) : lista.length === 0 ? (
        <Vacio>No hay préstamos activos.</Vacio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-medium">Préstamo</th>
                <th className="pb-2 font-medium">Saldo</th>
                <th className="pb-2 font-medium">Garantía</th>
                <th className="pb-2 font-medium">Vence</th>
                <th className="pb-2 font-medium">Vencido + recargo</th>
                <th className="pb-2 font-medium">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((l) => (
                <tr key={l.id} className="text-slate-700">
                  <td className="py-2.5">
                    #{l.onchain_loan_id} <span className="text-slate-400">· {l.student?.full_name ?? "—"}</span>
                  </td>
                  <td className="py-2.5">{usdc(l.outstanding)}</td>
                  <td className="py-2.5">{usdc(l.collateral_locked)}</td>
                  <td className="py-2.5">{fecha(l.vence)}</td>
                  <td className="py-2.5">{l.enMora ? `${usdc(l.vencido)} + ${usdc(l.recargo)}` : "—"}</td>
                  <td className="py-2.5">
                    <Estado status={l.enMora ? "mora" : "active"} />
                  </td>
                  <td className="py-2.5 text-right">
                    {l.liquidable && (
                      <Boton className="px-3 py-1.5" onClick={() => liquidar(l.onchain_loan_id)} disabled={ocupado !== null}>
                        {ocupado === l.onchain_loan_id && <Spinner />} Liquidar
                      </Boton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Solo se puede liquidar después del vencimiento + el periodo de gracia. El contrato toma capital + interés + recargo y
        devuelve el resto al depositante.
      </p>
    </Tarjeta>
  );
}

/* ---------------- Parámetros ---------------- */
type Ajustes = Record<
  | "max_ltv_bps"
  | "rate_bps"
  | "origination_fee_bps"
  | "late_fee_bps"
  | "yield_share_platform_bps"
  | "grace_seconds"
  | "min_amount_usd"
  | "max_amount_usd"
  | "max_installments",
  number
>;

const CAMPOS: { k: keyof Ajustes; t: string; hint: string }[] = [
  { k: "max_ltv_bps", t: "LTV máximo (bps)", hint: "8000 = 80% de la garantía" },
  { k: "rate_bps", t: "Tasa anual (bps)", hint: "800 = 8% anual sobre saldo" },
  { k: "origination_fee_bps", t: "Comisión de apertura (bps)", hint: "100 = 1%, se descuenta del desembolso" },
  { k: "late_fee_bps", t: "Recargo por mora (bps)", hint: "200 = 2% sobre lo vencido" },
  { k: "yield_share_platform_bps", t: "Rendimiento para la plataforma (bps)", hint: "Fase 2: 2500 = 25%" },
  { k: "grace_seconds", t: "Gracia (segundos)", hint: "2592000 = 30 días · demo: 120" },
  { k: "min_amount_usd", t: "Monto mínimo (USDC)", hint: "" },
  { k: "max_amount_usd", t: "Monto máximo (USDC)", hint: "" },
  { k: "max_installments", t: "Máximo de cuotas", hint: "" },
];

function Parametros() {
  const [form, setForm] = useState<Ajustes | null>(null);
  const [estado, setEstado] = useState<{ sincronizado: boolean; poolDisponible: number } | null>(null);
  const [msg, setMsg] = useState<{ tipo: "error" | "success"; t: string; link?: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    api<{ settings: Ajustes; cadena: Ajustes; sincronizado: boolean; poolDisponible: number }>("/api/settings").then((d) => {
      const base = d.cadena ?? d.settings;
      setForm(Object.fromEntries(CAMPOS.map(({ k }) => [k, Number(base[k])])) as Ajustes);
      setEstado({ sincronizado: d.sincronizado, poolDisponible: d.poolDisponible });
    });
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setMsg(null);
    setGuardando(true);
    try {
      const r = await api<{ link?: string }>("/api/settings", form, "PUT");
      setMsg({ tipo: "success", t: "Parámetros actualizados en el contrato y en la base.", link: r.link });
      cargar();
    } catch (err) {
      setMsg({ tipo: "error", t: (err as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  if (!form) return <Spinner className="h-6 w-6 text-teal-500" />;

  return (
    <Tarjeta
      titulo="Parámetros del negocio"
      accion={
        estado && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${estado.sincronizado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {estado.sincronizado ? "Base = contrato" : "Base distinta del contrato"}
          </span>
        )
      }
    >
      <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-3">
        {CAMPOS.map(({ k, t, hint }) => (
          <Campo key={k} label={t} htmlFor={k} hint={hint || undefined}>
            <input
              id={k}
              type="number"
              step="any"
              className={inputClase}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}
            />
          </Campo>
        ))}
        {msg && (
          <div className="sm:col-span-3">
            <Alerta tipo={msg.tipo}>
              {msg.t}{" "}
              {msg.link && (
                <a href={msg.link} target="_blank" rel="noreferrer" className="font-semibold underline">
                  Ver transacción
                </a>
              )}
            </Alerta>
          </div>
        )}
        <div className="sm:col-span-3">
          <Boton type="submit" disabled={guardando}>
            {guardando && <Spinner />} Guardar en el contrato
          </Boton>
          <p className="mt-2 text-xs text-slate-400">
            Se firma como admin con set_params. Los préstamos ya abiertos conservan sus condiciones.
          </p>
        </div>
      </form>
    </Tarjeta>
  );
}
