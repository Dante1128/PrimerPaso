const estudiantes = [
  "Tu primer crédito sin historial previo ni aval bancario.",
  "Liberas tu ahorro a medida que pagas: liquidez inmediata.",
  "Construyes un puntaje crediticio real y portable.",
  "Credencial de buen pagador verificable on-chain.",
];

const familias = [
  "Respaldas a tu estudiante sin regalar el dinero: sigue siendo tuyo.",
  "La garantía solo se usa si hay incumplimiento, y solo lo adeudado.",
  "Ves en todo momento el estado del préstamo que respaldas.",
  "Recuperas el ahorro completo cuando el préstamo se paga.",
];

function Check() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      className="mt-0.5 shrink-0"
    >
      <circle cx="12" cy="12" r="10" className="fill-emerald-100" />
      <path
        d="M8 12l2.5 2.5L16 9"
        stroke="#059669"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Beneficios() {
  return (
    <section id="beneficios" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
            Beneficios
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Para ti y para tu familia
          </h2>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {/* Estudiantes */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-600 text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22 10L12 5 2 10l10 5 10-5zM6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Estudiantes
                </h3>
                <p className="text-sm text-slate-500">
                  Tu primer paso hacia el crédito
                </p>
              </div>
            </div>
            <ul className="mt-6 space-y-4">
              {estudiantes.map((b) => (
                <li key={b} className="flex gap-3 text-slate-700">
                  <Check />
                  <span className="text-sm leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Familias garantes */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-600 text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 21s-7-4.3-7-9a4 4 0 017-2.6A4 4 0 0119 12c0 4.7-7 9-7 9z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Familias garantes
                </h3>
                <p className="text-sm text-slate-500">
                  Apoyas sin perder tu ahorro
                </p>
              </div>
            </div>
            <ul className="mt-6 space-y-4">
              {familias.map((b) => (
                <li key={b} className="flex gap-3 text-slate-700">
                  <Check />
                  <span className="text-sm leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
