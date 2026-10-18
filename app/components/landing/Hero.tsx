import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-teal-50/70 to-white">
      <div className="bg-dots absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        {/* Texto */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-medium text-teal-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Respaldado por tu ahorro en USDC · Stellar
          </span>

          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Tu ahorro abre tu{" "}
            <span className="bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent">
              primer crédito
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            Bloquea tus ahorros como garantía y recibe un préstamo al instante.
            Cada cuota que pagas libera parte de tu ahorro y construye tu
            historial crediticio. Pensado para estudiantes universitarios en
            Bolivia.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/registro"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              Comenzar
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <a
              href="#simulador"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
            >
              Probar el simulador
            </a>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 text-center">
            {[
              { n: "80%", t: "de tu ahorro como préstamo" },
              { n: "0", t: "comisiones ocultas" },
              { n: "100%", t: "verificable on-chain" },
            ].map((s) => (
              <div
                key={s.t}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <dt className="text-2xl font-bold text-teal-600">{s.n}</dt>
                <dd className="mt-1 text-xs leading-snug text-slate-500">
                  {s.t}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Tarjeta ilustrativa */}
        <div className="relative">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-teal-100/50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Tu garantía</p>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                Bloqueada
              </span>
            </div>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              1.000 <span className="text-lg font-semibold text-slate-400">USDC</span>
            </p>

            <div className="my-5 flex items-center justify-center">
              <div className="flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 5v14M6 13l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                genera un crédito de
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-teal-600 to-sky-600 p-5 text-white">
              <p className="text-sm text-teal-50">Préstamo disponible</p>
              <p className="mt-1 text-3xl font-bold">800 USDC</p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/25">
                <div className="h-full w-1/3 rounded-full bg-white" />
              </div>
              <p className="mt-2 text-xs text-teal-50">
                Garantía liberada: 33% · recuperas todo al terminar
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Cuota mensual</p>
                <p className="text-lg font-semibold text-slate-900">~138 USDC</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Puntaje</p>
                <p className="text-lg font-semibold text-emerald-600">+ sube</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
