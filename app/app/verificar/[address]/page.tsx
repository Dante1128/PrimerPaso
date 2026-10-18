// Verificador público: cualquiera puede comprobar en la blockchain el
// historial y la credencial de buen pagador de una wallet. Solo datos
// on-chain: ningún dato personal.
import Link from "next/link";
import { connection } from "next/server";
import Logo from "@/components/Logo";
import { Puntaje } from "@/components/panel/TarjetaCredito";
import { esDireccionStellar, perfilCrediticio } from "@/lib/credito";

export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return { title: `Verificar ${address.slice(0, 6)}…${address.slice(-4)} · PrimerPaso` };
}

export default async function VerificarPage({ params }: { params: Promise<{ address: string }> }) {
  await connection();
  const { address } = await params;
  const valida = esDireccionStellar(address);
  const perfil = valida ? await perfilCrediticio(address).catch(() => null) : null;
  const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-BO", { dateStyle: "long" });

  return (
    <main className="min-h-screen bg-gradient-to-b from-teal-50/60 to-white px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-block">
          <Logo />
        </Link>
        <h1 className="mt-8 text-2xl font-bold text-ink">Verificador de historial crediticio</h1>
        <p className="mt-1 break-all font-mono text-sm text-ink/60">{address}</p>

        {!valida && (
          <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            Esa no es una dirección Stellar válida (empieza con G y tiene 56 caracteres).
          </p>
        )}
        {valida && !perfil && (
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
            No se pudo leer la blockchain en este momento. Intenta de nuevo en unos segundos.
          </p>
        )}

        {perfil && (
          <div className="mt-6 space-y-4">
            <div
              className={`rounded-3xl border p-6 nb-shadow-sm ${
                perfil.credencial ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50" : "border-ink bg-white"
              }`}
            >
              {perfil.credencial ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brandink">Credencial verificada on-chain</p>
                  <p className="mt-1 text-2xl font-bold text-ink">Buen pagador ✓</p>
                  <p className="mt-2 text-sm text-ink/70">
                    {perfil.credencial.prestamosPagados} préstamo(s) pagado(s) por completo · emitida el{" "}
                    {fecha(perfil.credencial.emitida)}
                    {perfil.credencial.actualizada !== perfil.credencial.emitida && ` · actualizada el ${fecha(perfil.credencial.actualizada)}`}
                  </p>
                  <p className="mt-1 text-xs text-ink/60">No transferible: está ligada a esta wallet y nadie puede moverla.</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Sin credencial</p>
                  <p className="mt-1 text-lg font-semibold text-ink">Esta wallet aún no completó un préstamo</p>
                </>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border-2 border-ink bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Puntaje</p>
                <div className="mt-1">
                  <Puntaje valor={perfil.puntaje} />
                </div>
              </div>
              <dl className="space-y-2 rounded-2xl border-2 border-ink bg-white p-5 text-sm">
                <div className="flex justify-between"><dt className="text-ink/60">Cuotas a tiempo</dt><dd className="font-semibold text-brandink">{perfil.aTiempo}</dd></div>
                <div className="flex justify-between"><dt className="text-ink/60">Cuotas con atraso</dt><dd className="font-semibold">{perfil.atrasadas}</dd></div>
                <div className="flex justify-between"><dt className="text-ink/60">Préstamos pagados</dt><dd className="font-semibold">{perfil.prestamosPagados}</dd></div>
                <div className="flex justify-between"><dt className="text-ink/60">Liquidaciones</dt><dd className={`font-semibold ${perfil.defaults ? "text-coral" : ""}`}>{perfil.defaults}</dd></div>
              </dl>
            </div>

            <p className="text-xs text-ink/60">
              Leído en vivo del contrato de historial{" "}
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${perfil.contrato}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-brandink hover:underline"
              >
                {perfil.contrato.slice(0, 8)}…
              </a>{" "}
              en Stellar Testnet. Sin datos personales: solo la dirección y sus contadores.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
