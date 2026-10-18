// Puntaje, historial y credencial on-chain del usuario, más su saldo USDC.
import Link from "next/link";
import { Tarjeta, fecha, usdc } from "@/components/panel/comunes";

export type Credito = {
  saldoUsdc: number;
  perfil: {
    address: string;
    puntaje: number;
    aTiempo: number;
    atrasadas: number;
    defaults: number;
    prestamosPagados: number;
    credencial: null | { emitida: string; prestamosPagados: number };
  };
};

export function Puntaje({ valor }: { valor: number }) {
  const pct = ((valor - 300) / (850 - 300)) * 100;
  const color = valor >= 650 ? "text-emerald-600" : valor >= 500 ? "text-teal-600" : "text-amber-600";
  return (
    <div>
      <p className={`text-4xl font-bold ${color}`}>{valor}</p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gradient-to-r from-amber-200 via-teal-200 to-emerald-300">
        <div className="relative h-full" style={{ width: `${pct}%` }}>
          <span className="absolute -right-1 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-slate-800" />
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>300</span>
        <span>850</span>
      </div>
    </div>
  );
}

export default function TarjetaCredito({ credito, wallet }: { credito: Credito | null; wallet: string }) {
  const p = credito?.perfil;
  return (
    <Tarjeta
      titulo="Tu historial crediticio"
      accion={
        <Link href={`/verificar/${wallet}`} className="text-xs font-semibold text-teal-700 hover:underline">
          Ver verificador público ↗
        </Link>
      }
    >
      {!p ? (
        <p className="text-sm text-slate-500">Cargando desde la blockchain…</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Puntaje</p>
            <div className="mt-1">
              <Puntaje valor={p.puntaje} />
            </div>
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Cuotas a tiempo</dt>
              <dd className="font-semibold text-emerald-600">{p.aTiempo}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Con atraso</dt>
              <dd className="font-semibold text-slate-700">{p.atrasadas}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Préstamos pagados</dt>
              <dd className="font-semibold text-slate-700">{p.prestamosPagados}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Liquidaciones</dt>
              <dd className={`font-semibold ${p.defaults ? "text-rose-600" : "text-slate-700"}`}>{p.defaults}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1.5">
              <dt className="text-slate-500">Saldo en tu wallet</dt>
              <dd className="font-semibold text-slate-900">{usdc(credito?.saldoUsdc)}</dd>
            </div>
          </dl>
          <div>
            {p.credencial ? (
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Credencial on-chain</p>
                <p className="mt-1 font-semibold text-slate-900">Buen pagador ✓</p>
                <p className="mt-1 text-xs text-slate-500">
                  {p.credencial.prestamosPagados} préstamo(s) pagado(s) · emitida {fecha(p.credencial.emitida)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">No transferible: queda ligada a tu wallet.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                Al terminar de pagar tu primer préstamo recibes una <strong>credencial de buen pagador</strong>{" "}
                verificable por cualquiera en la blockchain.
              </div>
            )}
          </div>
        </div>
      )}
    </Tarjeta>
  );
}
