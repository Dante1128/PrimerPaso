import Link from "next/link";

export default function CTA() {
  return (
    <section className="bg-cream py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border-2 border-ink bg-brand px-6 py-14 text-center nb-shadow-lg sm:px-12">
          <div
            className="bg-dots absolute inset-0 opacity-20"
            aria-hidden="true"
          />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Da tu primer paso hoy
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg font-medium text-white/90">
              Crea tu cuenta, conecta tu wallet y convierte tu ahorro en tu
              primer crédito. Sin riesgo, sin dinero real: todo en Testnet.
            </p>
            <Link
              href="/registro"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-sun px-7 py-3 text-base font-bold text-ink nb-shadow nb-press"
            >
              Comenzar gratis
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
          </div>
        </div>
      </div>
    </section>
  );
}
