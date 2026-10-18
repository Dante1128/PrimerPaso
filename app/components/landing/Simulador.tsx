"use client";

import { useMemo, useState } from "react";

/** Tasa de interés mensual fija, plana sobre el plazo (ilustrativa). */
const TASA_MENSUAL = 0.01; // 1% por mes
/** Porcentaje de la garantía que se presta. */
const LTV = 0.8; // 80%

const PLAZOS = [3, 6, 12];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-BO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);

export default function Simulador() {
  const [garantia, setGarantia] = useState(1000);
  const [meses, setMeses] = useState(6);

  const r = useMemo(() => {
    const prestamo = garantia * LTV;
    const interes = prestamo * TASA_MENSUAL * meses;
    const deuda = prestamo + interes;
    const cuota = deuda / meses;
    const liberacionPorCuota = garantia / meses;

    const calendario = Array.from({ length: meses }, (_, i) => {
      const mes = i + 1;
      const liberadoAcum = liberacionPorCuota * mes;
      return {
        mes,
        cuota,
        liberado: liberadoAcum,
        restante: garantia - liberadoAcum,
        progreso: (mes / meses) * 100,
      };
    });

    return { prestamo, interes, deuda, cuota, calendario };
  }, [garantia, meses]);

  return (
    <section id="simulador" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
            Simulador
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Calcula tu crédito
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Ajusta tu garantía y el plazo para ver cuánto puedes pedir, tu cuota
            y cómo se libera tu ahorro.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-5">
          {/* Controles + resumen */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <label className="block text-sm font-medium text-slate-700">
                Monto de garantía (USDC)
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="number"
                  min={100}
                  max={20000}
                  step={50}
                  value={garantia}
                  onChange={(e) =>
                    setGarantia(Math.max(100, Number(e.target.value) || 0))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-lg font-semibold text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <input
                type="range"
                min={100}
                max={10000}
                step={50}
                value={garantia}
                onChange={(e) => setGarantia(Number(e.target.value))}
                className="mt-4 w-full accent-teal-600"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>100</span>
                <span>10.000</span>
              </div>

              <label className="mt-6 block text-sm font-medium text-slate-700">
                Plazo
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {PLAZOS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setMeses(p)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      meses === p
                        ? "border-teal-600 bg-teal-50 text-teal-700"
                        : "border-slate-300 text-slate-600 hover:border-teal-300"
                    }`}
                  >
                    {p} meses
                  </button>
                ))}
              </div>

              <dl className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Puedes pedir (80%)</dt>
                  <dd className="text-lg font-bold text-teal-600">
                    {fmt(r.prestamo)} USDC
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Cuota mensual</dt>
                  <dd className="font-semibold text-slate-900">
                    {fmt(r.cuota)} USDC
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Interés total</dt>
                  <dd className="font-semibold text-slate-900">
                    {fmt(r.interes)} USDC
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Total a pagar</dt>
                  <dd className="font-semibold text-slate-900">
                    {fmt(r.deuda)} USDC
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-slate-400">
                Tasa ilustrativa de {TASA_MENSUAL * 100}% mensual. Los valores
                son estimados; el contrato define los términos exactos.
              </p>
            </div>
          </div>

          {/* Calendario de liberación */}
          <div className="lg:col-span-3">
            <div className="h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Calendario de liberación de tu ahorro
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Cada cuota pagada te devuelve una parte de tu garantía.
              </p>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-medium">Mes</th>
                      <th className="px-4 py-3 font-medium">Cuota</th>
                      <th className="px-4 py-3 font-medium">Liberado</th>
                      <th className="px-4 py-3 font-medium">Restante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.calendario.map((c) => (
                      <tr key={c.mes} className="text-slate-700">
                        <td className="px-4 py-3 font-medium">{c.mes}</td>
                        <td className="px-4 py-3">{fmt(c.cuota)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-emerald-600">
                              {fmt(c.liberado)}
                            </span>
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                              <span
                                className="block h-full rounded-full bg-emerald-500"
                                style={{ width: `${c.progreso}%` }}
                              />
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {fmt(c.restante)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12l2 2 4-4m-3-7a9 9 0 110 18 9 9 0 010-18z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Al pagar la última cuota recuperas el 100% de tu garantía.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
