"use client";

import { useCallback, useEffect, useState } from "react";
import { Boton, Alerta, Spinner, Campo, inputClase } from "@/components/ui";
import { firmarXdr } from "@/lib/wallet";
import { fmtUsdc, stroopsAUsdc } from "@/lib/format";

const HISTORY_ID = process.env.NEXT_PUBLIC_HISTORY_CONTRACT_ID ?? "";
const EXPERT = "https://stellar.expert/explorer/testnet";

type Prestamo = {
  collateral: string;
  principal: string;
  totalDue: string;
  totalRepaid: string;
  collateralReleased: string;
  installments: number;
  installmentAmount: string;
  paidInstallments: number;
  interestRate: number;
  openedAt: number;
  period: number;
  status: string;
} | null;

type Estado = {
  wallet: string;
  prestamo: Prestamo;
  puntaje: number;
  registro: { onTime: number; late: number };
  credencial: {
    totalInstallments: number;
    onTime: number;
    late: number;
    issuedAt: number;
  } | null;
  usdcBalance: string;
};

type TxLocal = { kind: string; hash: string; amount: number; ts: number };

async function api(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Ocurrió un error");
  return data;
}

export default function PanelEstudiante() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [txs, setTxs] = useState<TxLocal[]>([]);
  const [accion, setAccion] = useState<string>("");
  const [aviso, setAviso] = useState<{ tipo: "success" | "info"; txt: string } | null>(
    null,
  );

  const cargar = useCallback(async () => {
    setError("");
    try {
      const d = (await api("/api/loan/state", undefined, "GET")) as Estado;
      setEstado(d);
      try {
        const guardados = localStorage.getItem(`pp_txs_${d.wallet}`);
        if (guardados) setTxs(JSON.parse(guardados));
      } catch {}
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarTx = useCallback(
    (wallet: string, tx: TxLocal) => {
      setTxs((prev) => {
        const next = [tx, ...prev].slice(0, 30);
        try {
          localStorage.setItem(`pp_txs_${wallet}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [],
  );

  /** prepara → firma → envía una invocación del contrato. */
  const ejecutar = useCallback(
    async (action: string, params: Record<string, unknown>, kind: string, amount: number) => {
      if (!estado) return;
      const { xdr } = await api("/api/loan/prepare", { action, ...params });
      const signed = await firmarXdr(xdr, estado.wallet);
      const res = await api("/api/loan/submit", { xdr: signed });
      if (res.hash) guardarTx(estado.wallet, { kind, hash: res.hash, amount, ts: Date.now() });
      return res;
    },
    [estado, guardarTx],
  );

  if (cargando) {
    return (
      <div className="grid place-items-center py-24 text-slate-400">
        <Spinner className="h-7 w-7 text-teal-500" />
      </div>
    );
  }

  if (error || !estado) {
    return (
      <div className="mx-auto max-w-md py-16">
        <Alerta tipo="error">{error || "No se pudo cargar el panel"}</Alerta>
        <div className="mt-4 text-center">
          <Boton onClick={cargar} variant="secondary">
            Reintentar
          </Boton>
        </div>
      </div>
    );
  }

  const p = estado.prestamo;
  const activo = p && p.status === "Active";
  const completado = p && p.status === "Completed";
  const liquidado = p && p.status === "Liquidated";

  // Métricas derivadas.
  const bloqueada = p
    ? BigInt(p.collateral) - BigInt(p.collateralReleased)
    : BigInt(0);
  const progreso =
    p && BigInt(p.collateral) > BigInt(0)
      ? Number((BigInt(p.collateralReleased) * BigInt(100)) / BigInt(p.collateral))
      : 0;
  const pendiente = p ? BigInt(p.totalDue) - BigInt(p.totalRepaid) : BigInt(0);
  const proximaCuota =
    p && activo
      ? BigInt(p.installmentAmount) < pendiente
        ? BigInt(p.installmentAmount)
        : pendiente
      : BigInt(0);
  const proximoVenc =
    p && activo
      ? new Date((p.openedAt + (p.paidInstallments + 1) * p.period) * 1000)
      : null;

  return (
    <div className="space-y-6">
      {aviso && <Alerta tipo={aviso.tipo}>{aviso.txt}</Alerta>}

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tarjeta
          etiqueta="Saldo USDC"
          valor={`${fmtUsdc(estado.usdcBalance)}`}
          sufijo="USDC"
        />
        <Tarjeta
          etiqueta="Garantía bloqueada"
          valor={fmtUsdc(bloqueada.toString())}
          sufijo="USDC"
          acento="teal"
        />
        <Tarjeta
          etiqueta="Préstamo activo"
          valor={activo ? fmtUsdc(p!.principal) : "0"}
          sufijo="USDC"
          acento="sky"
        />
        <Tarjeta etiqueta="Puntaje crediticio" valor={String(estado.puntaje)} />
      </div>

      {/* Zona principal según estado del préstamo */}
      {!p || (!activo && !completado && !liquidado) ? (
        <SolicitarCredito
          balance={stroopsAUsdc(estado.usdcBalance)}
          onSolicitar={async (garantia, meses) => {
            setAccion("solicitar");
            setAviso(null);
            try {
              const principal = Math.floor(garantia * 0.8 * 100) / 100;
              const interestRate = meses * 100; // 1% mensual (bps)
              setAviso({ tipo: "info", txt: "1/2 — Firma el depósito de garantía en tu wallet…" });
              await ejecutar("deposit", { amount: garantia }, "Depósito de garantía", garantia);
              setAviso({ tipo: "info", txt: "2/2 — Firma la apertura del crédito en tu wallet…" });
              await ejecutar(
                "open",
                { principal, installments: meses, interestRate },
                "Apertura de crédito",
                principal,
              );
              setAviso({ tipo: "success", txt: "¡Crédito abierto! Tu préstamo ya está activo." });
              await cargar();
            } catch (e) {
              setAviso(null);
              setError((e as Error).message);
            } finally {
              setAccion("");
            }
          }}
          trabajando={accion === "solicitar"}
        />
      ) : (
        <>
          {/* Progreso de liberación */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Liberación de tu garantía
              </h2>
              <span className="text-sm font-semibold text-emerald-600">
                {progreso}%
              </span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Mini k="Garantía total" v={`${fmtUsdc(p!.collateral)} USDC`} />
              <Mini k="Liberado" v={`${fmtUsdc(p!.collateralReleased)} USDC`} />
              <Mini k="Deuda pendiente" v={`${fmtUsdc(pendiente.toString())} USDC`} />
              <Mini
                k="Cuotas"
                v={`${p!.paidInstallments} / ${p!.installments}`}
              />
            </div>
          </div>

          {/* Pagar cuota */}
          {activo && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Próxima cuota
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {proximoVenc
                      ? `Vence el ${proximoVenc.toLocaleDateString("es-BO")}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {fmtUsdc(proximaCuota.toString())}{" "}
                    <span className="text-base font-medium text-slate-400">
                      USDC
                    </span>
                  </p>
                </div>
              </div>
              <Boton
                className="mt-4 w-full"
                disabled={accion === "pagar"}
                onClick={async () => {
                  setAccion("pagar");
                  setAviso(null);
                  setError("");
                  const antes = BigInt(p!.collateralReleased);
                  try {
                    const monto = stroopsAUsdc(proximaCuota.toString());
                    await ejecutar("repay", { amount: monto }, "Pago de cuota", monto);
                    const d = (await api("/api/loan/state", undefined, "GET")) as Estado;
                    const liberado = d.prestamo
                      ? BigInt(d.prestamo.collateralReleased) - antes
                      : BigInt(0);
                    setEstado(d);
                    setAviso({
                      tipo: "success",
                      txt: `¡Pago realizado! Se liberó ${fmtUsdc(liberado.toString())} USDC de tu garantía.`,
                    });
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setAccion("");
                  }
                }}
              >
                {accion === "pagar" && <Spinner />} Pagar cuota y liberar garantía
              </Boton>
            </div>
          )}

          {completado && (
            <Alerta tipo="success">
              🎉 ¡Felicidades! Pagaste todo tu préstamo y recuperaste el 100% de
              tu garantía.
            </Alerta>
          )}
          {liquidado && (
            <Alerta tipo="info">
              Este préstamo fue liquidado. El contrato tomó solo lo adeudado y te
              devolvió el resto de tu garantía.
            </Alerta>
          )}
        </>
      )}

      {/* Credencial de buen pagador */}
      {estado.credencial && <Credencial cred={estado.credencial} wallet={estado.wallet} />}

      {/* Historial */}
      <Historial
        txs={txs}
        registro={estado.registro}
        wallet={estado.wallet}
      />
    </div>
  );
}

/* ---------- subcomponentes ---------- */

function Tarjeta({
  etiqueta,
  valor,
  sufijo,
  acento,
}: {
  etiqueta: string;
  valor: string;
  sufijo?: string;
  acento?: "teal" | "sky";
}) {
  const color =
    acento === "teal"
      ? "text-teal-600"
      : acento === "sky"
        ? "text-sky-600"
        : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-400">{etiqueta}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>
        {valor}
        {sufijo && (
          <span className="ml-1 text-xs font-medium text-slate-400">{sufijo}</span>
        )}
      </p>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-400">{k}</p>
      <p className="font-semibold text-slate-800">{v}</p>
    </div>
  );
}

function SolicitarCredito({
  balance,
  onSolicitar,
  trabajando,
}: {
  balance: number;
  onSolicitar: (garantia: number, meses: number) => void;
  trabajando: boolean;
}) {
  const [garantia, setGarantia] = useState(Math.min(500, Math.floor(balance)) || 100);
  const [meses, setMeses] = useState(6);
  const prestamo = garantia * 0.8;
  const interes = prestamo * 0.01 * meses;
  const total = prestamo + interes;
  const cuota = total / meses;
  const excede = garantia > balance;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Solicitar crédito</h2>
      <p className="mt-1 text-sm text-slate-500">
        Bloquea una garantía y recibe el 80% como préstamo. Tu saldo:{" "}
        <strong>{balance.toFixed(2)} USDC</strong>.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="space-y-4">
          <Campo label="Monto de garantía (USDC)" error={excede ? "Supera tu saldo" : undefined}>
            <input
              type="number"
              min={10}
              step={10}
              className={inputClase}
              value={garantia}
              onChange={(e) => setGarantia(Math.max(0, Number(e.target.value)))}
            />
          </Campo>
          <Campo label="Plazo">
            <div className="grid grid-cols-3 gap-2">
              {[3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMeses(m)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    meses === m
                      ? "border-teal-600 bg-teal-50 text-teal-700"
                      : "border-slate-300 text-slate-600 hover:border-teal-300"
                  }`}
                >
                  {m} meses
                </button>
              ))}
            </div>
          </Campo>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <dl className="space-y-2.5 text-sm">
            <Fila k="Préstamo (80%)" v={`${prestamo.toFixed(2)} USDC`} fuerte />
            <Fila k="Cuota mensual" v={`${cuota.toFixed(2)} USDC`} />
            <Fila k="Interés total" v={`${interes.toFixed(2)} USDC`} />
            <Fila k="Total a pagar" v={`${total.toFixed(2)} USDC`} />
          </dl>
        </div>
      </div>

      <Boton
        className="mt-5 w-full"
        disabled={trabajando || excede || garantia < 10}
        onClick={() => onSolicitar(garantia, meses)}
      >
        {trabajando && <Spinner />} Solicitar y firmar
      </Boton>
      <p className="mt-2 text-center text-xs text-slate-400">
        Firmarás dos transacciones: el depósito de garantía y la apertura del
        crédito.
      </p>
    </div>
  );
}

function Fila({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd className={fuerte ? "text-base font-bold text-teal-600" : "font-semibold text-slate-800"}>
        {v}
      </dd>
    </div>
  );
}

function Credencial({
  cred,
  wallet,
}: {
  cred: { totalInstallments: number; onTime: number; late: number; issuedAt: number };
  wallet: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-600 to-sky-600 p-6 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-teal-100">
            Credencial verificable on-chain
          </p>
          <h2 className="mt-1 text-xl font-bold">Buen pagador ✓</h2>
        </div>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="opacity-90">
          <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 19l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 2z" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-white/15 p-2">
          <p className="text-lg font-bold">{cred.totalInstallments}</p>
          <p className="text-[11px] text-teal-50">cuotas</p>
        </div>
        <div className="rounded-xl bg-white/15 p-2">
          <p className="text-lg font-bold">{cred.onTime}</p>
          <p className="text-[11px] text-teal-50">a tiempo</p>
        </div>
        <div className="rounded-xl bg-white/15 p-2">
          <p className="text-lg font-bold">{cred.late}</p>
          <p className="text-[11px] text-teal-50">atrasadas</p>
        </div>
      </div>
      <a
        href={`${EXPERT}/contract/${HISTORY_ID}`}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-white underline underline-offset-2"
      >
        Verificar en stellar.expert
      </a>
    </div>
  );
}

function Historial({
  txs,
  registro,
  wallet,
}: {
  txs: TxLocal[];
  registro: { onTime: number; late: number };
  wallet: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Historial</h2>
        <a
          href={`${EXPERT}/account/${wallet}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-teal-600 hover:underline"
        >
          Ver cuenta en stellar.expert
        </a>
      </div>
      <div className="mt-2 flex gap-4 text-sm text-slate-500">
        <span>
          A tiempo: <strong className="text-emerald-600">{registro.onTime}</strong>
        </span>
        <span>
          Atrasadas: <strong className="text-rose-500">{registro.late}</strong>
        </span>
      </div>

      {txs.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          Aún no hay transacciones hechas desde esta app.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {txs.map((t) => (
            <li
              key={t.hash}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-slate-800">{t.kind}</p>
                <p className="text-xs text-slate-400">
                  {new Date(t.ts).toLocaleString("es-BO")} · {t.amount} USDC
                </p>
              </div>
              <a
                href={`${EXPERT}/tx/${t.hash}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 font-mono text-xs text-teal-600 hover:underline"
              >
                {t.hash.slice(0, 8)}…
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
