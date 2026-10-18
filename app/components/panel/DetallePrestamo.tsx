"use client";

import { useCallback, useEffect, useState } from "react";
import { api, firmarYEnviar } from "@/lib/cliente";
import { Alerta, Boton, Spinner } from "@/components/ui";
import { Barra, Dato, Estado, LinkTx, Tarjeta, fecha, usdc } from "@/components/panel/comunes";

type Cotizacion = {
  interes: number;
  capitalProximaCuota: number;
  totalProximaCuota: number;
  saldoCapital: number;
  vence: string;
  vencido: number;
  enMora: boolean;
  liquidable: boolean;
  recargo: number;
};

type Detalle = {
  prestamo: {
    onchain_loan_id: number;
    principal: number;
    origination_fee: number;
    collateral_initial: number;
    collateral_released: number;
    collateral_locked: number;
    principal_paid: number;
    interest_paid: number;
    outstanding: number;
    installments: number;
    rate_bps: number;
    status: string;
    opened_at: string;
    opened_tx_hash: string | null;
    depositor_address: string;
    borrower_address: string;
  };
  cadena: { capitalPagado: number; garantiaLiberada: number; garantiaInicial: number; cuotasPagadas: number } | null;
  cotizacion: Cotizacion | null;
  cuotas: { id: string; number: number; due_at: string; principal_due: number; interest_due: number; status: string; paid_at: string | null }[];
  pagos: { id: string; principal: number; interest: number; on_time: boolean | null; tx_hash: string; created_at: string }[];
  garantia: { id: string; type: string; amount: number; tx_hash: string; created_at: string }[];
};

const TIPO_GARANTIA: Record<string, string> = {
  deposit: "Depósito",
  release: "Liberada",
  liquidation: "Tomada en liquidación",
  return: "Remanente devuelto",
  withdraw: "Retirada",
};

export default function DetallePrestamo({ loanId, wallet, onCambio }: { loanId: number; wallet: string; onCambio?: () => void }) {
  const [d, setD] = useState<Detalle | null>(null);
  const [error, setError] = useState("");
  const [pagando, setPagando] = useState(false);
  const [ok, setOk] = useState<{ link?: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      setD(await api<Detalle>(`/api/loans/status?loanId=${loanId}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loanId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function pagar() {
    setError("");
    setOk(null);
    setPagando(true);
    try {
      const r = await firmarYEnviar(wallet, "/api/payments/prepare", "/api/payments/submit", { loanId });
      setOk({ link: r.link as string | undefined });
      await cargar();
      onCambio?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPagando(false);
    }
  }

  if (!d) {
    return (
      <Tarjeta>
        {error ? <Alerta tipo="error">{error}</Alerta> : <Spinner className="h-5 w-5 text-teal-500" />}
      </Tarjeta>
    );
  }

  const p = d.prestamo;
  const q = d.cotizacion;
  const garantiaLiberada = d.cadena?.garantiaLiberada ?? Number(p.collateral_released);
  const pctCapital = (Number(p.principal_paid) / Number(p.principal)) * 100;
  const pctGarantia = (garantiaLiberada / Number(p.collateral_initial)) * 100;

  return (
    <div className="space-y-4">
      <Tarjeta
        titulo={`Préstamo #${p.onchain_loan_id}`}
        accion={<Estado status={q?.enMora ? "mora" : p.status} />}
      >
        <div className="grid gap-5 sm:grid-cols-4">
          <Dato label="Monto" valor={usdc(p.principal)} sub={`Recibiste ${usdc(Number(p.principal) - Number(p.origination_fee))}`} />
          <Dato label="Saldo de capital" valor={usdc(p.outstanding)} sub={`${p.installments} cuotas · ${p.rate_bps / 100}% anual`} />
          <Dato label="Garantía bloqueada" valor={usdc(p.collateral_locked)} sub={`de ${usdc(p.collateral_initial)}`} />
          <Dato label="Interés pagado" valor={usdc(p.interest_paid)} />
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-slate-500">
              <span>Capital pagado</span>
              <span className="font-semibold text-slate-700">{pctCapital.toFixed(0)}%</span>
            </div>
            <Barra pct={pctCapital} color="from-sky-500 to-teal-500" />
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-slate-500">
              <span>Garantía liberada · {usdc(garantiaLiberada)}</span>
              <span className="font-semibold text-emerald-600">{pctGarantia.toFixed(0)}%</span>
            </div>
            <Barra pct={pctGarantia} />
          </div>
        </div>

        {q && p.status === "active" && (
          <div className={`mt-6 rounded-xl p-4 ${q.enMora ? "bg-rose-50" : "bg-teal-50"}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className={`text-sm font-medium ${q.enMora ? "text-rose-700" : "text-teal-800"}`}>
                  {q.enMora ? "Cuota vencida" : "Próxima cuota"} · vence {fecha(q.vence)}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{usdc(q.totalProximaCuota)}</p>
                <p className="text-xs text-slate-500">
                  Capital {usdc(q.capitalProximaCuota)} + interés {usdc(q.interes)} · libera{" "}
                  {usdc((q.capitalProximaCuota / Number(p.principal)) * Number(p.collateral_initial))} de garantía
                </p>
                {q.enMora && (
                  <p className="mt-1 text-xs font-medium text-rose-700">
                    {q.liquidable
                      ? "Pasó el periodo de gracia: el préstamo puede liquidarse."
                      : "Paga pronto: al terminar la gracia el préstamo puede liquidarse."}
                  </p>
                )}
              </div>
              <Boton onClick={pagar} disabled={pagando}>
                {pagando && <Spinner />} Pagar con Freighter
              </Boton>
            </div>
          </div>
        )}

        {error && <div className="mt-4"><Alerta tipo="error">{error}</Alerta></div>}
        {ok && (
          <div className="mt-4">
            <Alerta tipo="success">
              Pago registrado on-chain.{" "}
              {ok.link && (
                <a href={ok.link} target="_blank" rel="noreferrer" className="font-semibold underline">
                  Ver en stellar.expert
                </a>
              )}
            </Alerta>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Calendario de cuotas">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Vence</th>
                <th className="pb-2 font-medium">Capital</th>
                <th className="pb-2 font-medium">Interés (est.)</th>
                <th className="pb-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.cuotas.map((c) => (
                <tr key={c.id} className="text-slate-700">
                  <td className="py-2 font-medium">{c.number}</td>
                  <td className="py-2">{fecha(c.due_at)}</td>
                  <td className="py-2">{usdc(c.principal_due)}</td>
                  <td className="py-2">{usdc(c.interest_due)}</td>
                  <td className="py-2">
                    <Estado status={c.status === "pending" && new Date(c.due_at) < new Date() && p.status === "active" ? "mora" : c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Pagos">
          {d.pagos.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay pagos.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {d.pagos.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium text-slate-800">
                      {usdc(Number(x.principal) + Number(x.interest))}{" "}
                      <span className="text-xs font-normal text-slate-400">
                        (capital {usdc(x.principal)} + interés {usdc(x.interest)})
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {fecha(x.created_at)} · {x.on_time === false ? "con atraso" : "a tiempo"}
                    </p>
                  </div>
                  <LinkTx hash={x.tx_hash} />
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Movimientos de la garantía">
          <ul className="divide-y divide-slate-100 text-sm">
            {d.garantia.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">
                    {TIPO_GARANTIA[g.type] ?? g.type} · {usdc(g.amount)}
                  </p>
                  <p className="text-xs text-slate-500">{fecha(g.created_at)}</p>
                </div>
                <LinkTx hash={g.tx_hash} />
              </li>
            ))}
            {p.opened_tx_hash && (
              <li className="flex items-center justify-between gap-3 py-2">
                <p className="text-slate-600">Apertura del préstamo · {fecha(p.opened_at)}</p>
                <LinkTx hash={p.opened_tx_hash} />
              </li>
            )}
          </ul>
        </Tarjeta>
      </div>
    </div>
  );
}
