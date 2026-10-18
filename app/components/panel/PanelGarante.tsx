"use client";

import { useEffect, useState } from "react";
import { Alerta, Spinner } from "@/components/ui";
import { fmtUsdc, cortarDir } from "@/lib/format";
import { EstadoBadge, ProgresoMini } from "@/components/panel/comunes";

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

type Respaldo = {
  estudiante: {
    nombre: string;
    universidad: string;
    carrera: string;
    wallet: string | null;
  };
  prestamo: Prestamo;
  enMora: boolean;
};

export default function PanelGarante() {
  const [respaldos, setRespaldos] = useState<Respaldo[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/guarantor/loans")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setRespaldos(d.respaldos);
      })
      .catch(() => setError("No se pudo cargar"));
  }, []);

  if (error) return <Alerta tipo="error">{error}</Alerta>;
  if (!respaldos)
    return (
      <div className="grid place-items-center py-24 text-slate-400">
        <Spinner className="h-7 w-7 text-teal-500" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Préstamos que respaldas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tu ahorro respalda a estos estudiantes. Solo se usaría en caso de
          incumplimiento, y únicamente por el monto adeudado.
        </p>
      </div>

      {respaldos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">
            Aún no respaldas a ningún estudiante.
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Pídele a tu estudiante su código de invitación y vincúlate desde el
            registro.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {respaldos.map((r, i) => (
            <div
              key={i}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    {r.estudiante.nombre}
                  </p>
                  <p className="text-xs text-slate-400">
                    {r.estudiante.carrera} · {r.estudiante.universidad}
                  </p>
                  {r.estudiante.wallet && (
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      {cortarDir(r.estudiante.wallet)}
                    </p>
                  )}
                </div>
                {r.prestamo && (
                  <EstadoBadge status={r.prestamo.status} enMora={r.enMora} />
                )}
              </div>

              {r.prestamo ? (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Dato k="Préstamo" v={`${fmtUsdc(r.prestamo.principal)} USDC`} />
                    <Dato
                      k="Garantía"
                      v={`${fmtUsdc(r.prestamo.collateral)} USDC`}
                    />
                    <Dato
                      k="Deuda pendiente"
                      v={`${fmtUsdc((BigInt(r.prestamo.totalDue) - BigInt(r.prestamo.totalRepaid)).toString())} USDC`}
                    />
                    <Dato
                      k="Cuotas"
                      v={`${r.prestamo.paidInstallments} / ${r.prestamo.installments}`}
                    />
                  </div>
                  <ProgresoMini
                    released={r.prestamo.collateralReleased}
                    total={r.prestamo.collateral}
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Este estudiante aún no ha abierto un préstamo.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-400">{k}</p>
      <p className="font-semibold text-slate-800">{v}</p>
    </div>
  );
}
