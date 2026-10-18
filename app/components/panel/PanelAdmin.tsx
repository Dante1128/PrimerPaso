"use client";

import { useCallback, useEffect, useState } from "react";
import { Alerta, Spinner, Boton } from "@/components/ui";
import { fmtUsdc, cortarDir } from "@/lib/format";
import { EstadoBadge } from "@/components/panel/comunes";

type Prestamo = {
  collateral: string;
  principal: string;
  totalDue: string;
  totalRepaid: string;
  collateralReleased: string;
  installments: number;
  paidInstallments: number;
  status: string;
} | null;

type Fila = {
  estudiante: { nombre: string; universidad: string; wallet: string };
  prestamo: Prestamo;
  puntaje: number;
  enMora: boolean;
};

const EXPERT = "https://stellar.expert/explorer/testnet";

export default function PanelAdmin() {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [liquidando, setLiquidando] = useState("");

  const cargar = useCallback(async () => {
    setError("");
    try {
      const r = await fetch("/api/admin/loans");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Error");
      setFilas(d.prestamos);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function liquidar(wallet: string) {
    setLiquidando(wallet);
    setAviso("");
    setError("");
    try {
      const r = await fetch("/api/admin/liquidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ borrower: wallet }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo liquidar");
      setAviso(`Garantía ejecutada. Tx: ${d.hash}`);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLiquidando("");
    }
  }

  if (error && !filas) return <Alerta tipo="error">{error}</Alerta>;
  if (!filas)
    return (
      <div className="grid place-items-center py-24 text-slate-400">
        <Spinner className="h-7 w-7 text-teal-500" />
      </div>
    );

  const activos = filas.filter((f) => f.prestamo?.status === "Active");
  const enMora = activos.filter((f) => f.enMora);
  const totalPrestado = activos.reduce(
    (acc, f) => acc + BigInt(f.prestamo!.principal),
    BigInt(0),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administración</h1>
        <p className="mt-1 text-sm text-slate-500">
          Supervisa los préstamos y ejecuta la garantía de los que caen en mora.
        </p>
      </div>

      {aviso && <Alerta tipo="success">{aviso}</Alerta>}
      {error && <Alerta tipo="error">{error}</Alerta>}

      <div className="grid grid-cols-3 gap-4">
        <Stat etiqueta="Préstamos activos" valor={String(activos.length)} />
        <Stat etiqueta="En mora" valor={String(enMora.length)} acento="rose" />
        <Stat
          etiqueta="Total prestado"
          valor={`${fmtUsdc(totalPrestado.toString())}`}
          sufijo="USDC"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Estudiante</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Préstamo</th>
                <th className="px-4 py-3 font-medium">Deuda</th>
                <th className="px-4 py-3 font-medium">Cuotas</th>
                <th className="px-4 py-3 font-medium">Puntaje</th>
                <th className="px-4 py-3 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((f, i) => {
                const p = f.prestamo;
                const deuda = p
                  ? (BigInt(p.totalDue) - BigInt(p.totalRepaid)).toString()
                  : "0";
                return (
                  <tr key={i} className="text-slate-700">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {f.estudiante.nombre}
                      </p>
                      <a
                        href={`${EXPERT}/account/${f.estudiante.wallet}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-teal-600 hover:underline"
                      >
                        {cortarDir(f.estudiante.wallet)}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {p ? (
                        <EstadoBadge status={p.status} enMora={f.enMora} />
                      ) : (
                        <span className="text-xs text-slate-400">Sin préstamo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p ? `${fmtUsdc(p.principal)} USDC` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p ? `${fmtUsdc(deuda)} USDC` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p ? `${p.paidInstallments}/${p.installments}` : "—"}
                    </td>
                    <td className="px-4 py-3">{f.puntaje}</td>
                    <td className="px-4 py-3">
                      {p?.status === "Active" ? (
                        <Boton
                          variant={f.enMora ? "primary" : "secondary"}
                          disabled={!f.enMora || liquidando === f.estudiante.wallet}
                          onClick={() => liquidar(f.estudiante.wallet)}
                          className="!px-3 !py-1.5 text-xs"
                        >
                          {liquidando === f.estudiante.wallet && <Spinner />}
                          Ejecutar garantía
                        </Boton>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        La garantía solo puede ejecutarse cuando hay una cuota vencida (el
        contrato lo exige). Toma únicamente lo adeudado y devuelve el resto al
        estudiante.
      </p>
    </div>
  );
}

function Stat({
  etiqueta,
  valor,
  sufijo,
  acento,
}: {
  etiqueta: string;
  valor: string;
  sufijo?: string;
  acento?: "rose";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-400">{etiqueta}</p>
      <p
        className={`mt-1 text-2xl font-bold ${acento === "rose" ? "text-rose-600" : "text-slate-900"}`}
      >
        {valor}
        {sufijo && (
          <span className="ml-1 text-xs font-medium text-slate-400">{sufijo}</span>
        )}
      </p>
    </div>
  );
}
