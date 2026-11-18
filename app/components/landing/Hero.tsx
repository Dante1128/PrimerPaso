import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-cream">
      {/* Manchas decorativas suaves */}
      <div className="pointer-events-none absolute -right-10 top-10 hidden h-24 w-24 rounded-2xl bg-sun/40 blur-2xl lg:block" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-8 bottom-10 hidden h-16 w-16 rounded-full bg-coral/30 blur-2xl lg:block" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        {/* Texto */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-bold text-ink nb-shadow-sm">
            <span className="h-2 w-2 rounded-full bg-lime" />
            Respaldado por tu ahorro en USDC · Stellar
          </span>

          <h1 className="mt-5 text-4xl font-bold leading-[1.1] text-ink sm:text-5xl">
            Tu ahorro abre tu{" "}
            <span className="inline-block rounded-lg bg-sun/30 px-2 text-brandink">
              primer crédito
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-ink/70">
            Bloquea tus ahorros como garantía y recibe tu préstamo apenas lo
            aprobamos (normalmente en menos de 24 h). Cada cuota que pagas te
            devuelve parte de tu ahorro y construye tu historial crediticio. Pensado para estudiantes universitarios en
            Bolivia.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/registro"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-base font-bold text-white nb-shadow nb-press"
            >
              Comenzar
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <a
              href="#simulador"
              className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-6 py-3 text-base font-bold text-ink nb-shadow nb-press"
            >
              Probar el simulador
            </a>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-3 text-center">
            {[
              { n: "80%", t: "de tu ahorro como préstamo", bg: "bg-sun/15" },
              { n: "8%", t: "anual sobre saldo, sin sorpresas", bg: "bg-azure/15" },
              { n: "100%", t: "verificable por cualquiera", bg: "bg-lime/15" },
            ].map((s) => (
              <div
                key={s.t}
                className={`rounded-xl ${s.bg} p-4`}
              >
                <dt className="text-2xl font-bold text-ink">{s.n}</dt>
                <dd className="mt-1 text-xs font-semibold leading-snug text-ink/70">
                  {s.t}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Tarjeta ilustrativa */}
        <div className="relative">
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 nb-shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-ink/60">Tu garantía</p>
              <span className="rounded-full bg-lime/15 px-2.5 py-0.5 text-xs font-bold text-lime">
                Bloqueada
              </span>
            </div>
            <p className="mt-1 text-3xl font-bold text-ink">
              1.250 <span className="text-lg font-bold text-ink/40">USDC</span>
            </p>

            <div className="my-5 flex items-center justify-center">
              <div className="flex items-center gap-2 rounded-full bg-sun/15 px-3 py-1.5 text-xs font-bold text-sun">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 5v14M6 13l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                genera un crédito de
              </div>
            </div>

            <div className="rounded-xl bg-brand p-5 text-white">
              <p className="text-sm font-semibold text-white/90">Préstamo disponible</p>
              <p className="mt-1 text-3xl font-bold">1.000 USDC</p>
              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/25">
                <div className="h-full w-1/3 rounded-full bg-white" />
              </div>
              <p className="mt-2 text-xs font-medium text-white/90">
                Cada cuota te devuelve 125 USDC · recuperas todo al terminar
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-cream p-3">
                <p className="text-xs font-semibold text-ink/60">1ª de 10 cuotas</p>
                <p className="text-lg font-bold text-ink">106,67 USDC</p>
              </div>
              <div className="rounded-xl bg-cream p-3">
                <p className="text-xs font-semibold text-ink/60">Puntaje</p>
                <p className="text-lg font-bold text-brandink">+ sube</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
