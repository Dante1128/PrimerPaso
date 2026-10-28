"use client";
// Simulador del préstamo con la misma matemática del contrato.
// Arranca en el ejemplo de referencia: 1.000 USDC en 10 cuotas.

import { useEffect, useMemo, useState } from "react";
import { PARAMETROS_BASE, fmt, simular, type Parametros } from "@/lib/calculos";

/** Lee los parámetros vigentes (públicos) una sola vez. */
export function useParametros(): Parametros {
  const [p, setP] = useState<Parametros>(PARAMETROS_BASE);
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(({ settings: s }) => {
        if (!s) return;
        setP({
          max_ltv_bps: s.max_ltv_bps,
          rate_bps: s.rate_bps,
          origination_fee_bps: s.origination_fee_bps,
          late_fee_bps: s.late_fee_bps,
          min_amount_usd: Number(s.min_amount_usd),
          max_amount_usd: Number(s.max_amount_usd),
          max_installments: s.max_installments,
        });
      })
      .catch(() => {});
  }, []);
  return p;
}

export default function SimuladorPrestamo({
  montoInicial = 1000,
  cuotasIniciales = 10,
  onUsar,
  textoUsar = "Solicitar este préstamo",
}: {
  montoInicial?: number;
  cuotasIniciales?: number;
  onUsar?: (monto: number, cuotas: number) => void;
  textoUsar?: string;
}) {
  const p = useParametros();
  const [monto, setMonto] = useState(montoInicial);
  const [cuotas, setCuotas] = useState(cuotasIniciales);
  const montoValido = Math.min(Math.max(monto || 0, p.min_amount_usd), p.max_amount_usd);
  const s = useMemo(() => simular(montoValido, Math.min(cuotas, p.max_installments), p), [montoValido, cuotas, p]);
  const fueraDeRango = monto < p.min_amount_usd || monto > p.max_amount_usd;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Controles y resumen */}
      <div className="min-w-0 lg:col-span-2">
        <div className="nb-card p-6">
          <label htmlFor="sim-monto" className="block text-sm font-bold text-ink">
            ¿Cuánto necesitas? (USDC)
          </label>
          <input
            id="sim-monto"
            type="number"
            min={p.min_amount_usd}
            max={p.max_amount_usd}
            step={50}
            value={monto}
            onChange={(e) => setMonto(Number(e.target.value))}
            className="mt-2 w-full rounded-xl border-2 border-ink px-3 py-2 text-lg font-bold text-ink outline-none transition focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[3px_3px_0_0_#141414]"
          />
          <input
            type="range"
            aria-label="Monto"
            min={p.min_amount_usd}
            max={p.max_amount_usd}
            step={50}
            value={montoValido}
            onChange={(e) => setMonto(Number(e.target.value))}
            className="mt-4 w-full accent-brand"
          />
          <div className="mt-1 flex justify-between text-xs text-ink/50">
            <span>{fmt(p.min_amount_usd)}</span>
            <span>{fmt(p.max_amount_usd)}</span>
          </div>
          {fueraDeRango && (
            <p className="mt-1 text-xs text-ink">
              El monto va de {fmt(p.min_amount_usd)} a {fmt(p.max_amount_usd)} USDC.
            </p>
          )}

          <label htmlFor="sim-cuotas" className="mt-5 block text-sm font-bold text-ink">
            Cuotas mensuales: <span className="font-bold text-brandink">{s.cuotas}</span>
          </label>
          <input
            id="sim-cuotas"
            type="range"
            min={1}
            max={p.max_installments}
            value={s.cuotas}
            onChange={(e) => setCuotas(Number(e.target.value))}
            className="mt-2 w-full accent-brand"
          />

          <dl className="mt-6 space-y-2.5 border-t-2 border-ink/10 pt-5 text-sm">
            <Fila t={`Garantía a bloquear (${p.max_ltv_bps / 100}% LTV)`} v={`${fmt(s.garantia)} USDC`} />
            <Fila t={`Comisión de apertura (${p.origination_fee_bps / 100}%)`} v={`− ${fmt(s.comision)} USDC`} />
            <Fila t="Recibes en tu wallet" v={`${fmt(s.recibes)} USDC`} fuerte />
            <Fila t={`Interés total (${p.rate_bps / 100}% anual sobre saldo)`} v={`${fmt(s.interesTotal)} USDC`} />
          </dl>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-ink bg-cream p-3">
              <p className="text-xs font-semibold text-ink/60">Costo bruto</p>
              <p className="text-lg font-bold text-ink">{fmt(s.totalPagado)}</p>
              <p className="text-[11px] text-ink/50">capital + interés que pagas</p>
            </div>
            <div className="rounded-xl border-2 border-ink bg-brand/15 p-3">
              <p className="text-xs font-semibold text-brandink">Costo neto</p>
              <p className="text-lg font-bold text-brandink">{fmt(s.costoNeto)}</p>
              <p className="text-[11px] text-brandink/70">interés + comisión · {fmt(s.costoNetoPct)}%</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink/50">
            Al terminar recuperas el 100% de tu garantía ({fmt(s.garantia)} USDC). Montos exactos del contrato, pagando a
            tiempo.
          </p>

          {onUsar && (
            <button
              type="button"
              disabled={fueraDeRango}
              onClick={() => onUsar(s.monto, s.cuotas)}
              className="mt-5 w-full rounded-xl border-2 border-ink bg-brand px-5 py-2.5 text-sm font-bold text-white nb-shadow nb-press disabled:opacity-50"
            >
              {textoUsar}
            </button>
          )}
        </div>
      </div>

      {/* Calendario */}
      <div className="min-w-0 lg:col-span-3">
        <div className="h-full rounded-3xl border-2 border-ink bg-white p-6 nb-shadow-sm">
          <h3 className="text-lg font-bold text-ink">Tus cuotas y tu garantía</h3>
          <p className="mt-1 text-sm font-medium text-ink/60">Cada cuota paga capital e interés, y te devuelve parte de tu garantía.</p>
          <div className="mt-5 max-h-[420px] overflow-auto rounded-xl border-2 border-ink">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-cream text-left text-xs font-bold uppercase tracking-wide text-ink/60">
                  <th className="px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Cuota</th>
                  <th className="px-3 py-2.5 font-medium">Interés</th>
                  <th className="px-3 py-2.5 font-medium">Te devuelve</th>
                  <th className="px-3 py-2.5 font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {s.calendario.map((c) => (
                  <tr key={c.numero} className="text-ink/80">
                    <td className="px-3 py-2.5 font-medium">{c.numero}</td>
                    <td className="px-3 py-2.5 font-semibold">{fmt(c.total)}</td>
                    <td className="px-3 py-2.5 text-ink/60">{fmt(c.interes)}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-brandink">+{fmt(c.garantiaLiberada)}</span>
                      <span className="ml-1.5 text-xs text-ink/50">({fmt(c.garantiaLiberadaAcumulada)})</span>
                    </td>
                    <td className="px-3 py-2.5 text-ink/60">{fmt(c.saldoDespues)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fila({ t, v, fuerte }: { t: string; v: string; fuerte?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink/60">{t}</dt>
      <dd className={fuerte ? "text-lg font-bold text-brandink" : "font-semibold text-ink"}>{v}</dd>
    </div>
  );
}
