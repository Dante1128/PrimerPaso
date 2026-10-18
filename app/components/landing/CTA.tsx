import Link from "next/link";

export default function CTA() {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 to-sky-600 px-6 py-14 text-center shadow-lg sm:px-12">
          <div
            className="bg-dots absolute inset-0 opacity-10"
            aria-hidden="true"
          />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Da tu primer paso hoy
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-teal-50">
              Crea tu cuenta, conecta tu wallet y convierte tu ahorro en tu
              primer crédito. Sin riesgo, sin dinero real: todo en Testnet.
            </p>
            <Link
              href="/registro"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-base font-semibold text-teal-700 shadow-sm transition hover:bg-teal-50"
            >
              Comenzar gratis
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
          </div>
        </div>
      </div>
    </section>
  );
}
