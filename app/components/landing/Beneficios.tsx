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
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className="mt-0.5 shrink-0"
    >
      <circle cx="12" cy="12" r="10" className="fill-lime" stroke="#141414" strokeWidth="2" />
      <path
        d="M8 12l2.5 2.5L16 9"
        stroke="#141414"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Beneficios() {
  return (
    <section id="beneficios" className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-block rotate-1 border-2 border-ink bg-azure px-3 py-1 text-sm font-bold uppercase tracking-wide text-ink nb-shadow-sm">
            Beneficios
          </p>
          <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">
            Para ti y para tu familia
          </h2>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {/* Estudiantes */}
          <div className="rounded-2xl border-2 border-ink bg-white p-8 nb-shadow-lg">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-brand text-white nb-shadow-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22 10L12 5 2 10l10 5 10-5zM6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h3 className="text-xl font-bold text-ink">Estudiantes</h3>
                <p className="text-sm font-medium text-ink/60">
                  Tu primer paso hacia el crédito
                </p>
              </div>
            </div>
            <ul className="mt-6 space-y-4">
              {estudiantes.map((b) => (
                <li key={b} className="flex gap-3 text-ink/80">
                  <Check />
                  <span className="text-sm font-medium leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Familias garantes */}
          <div className="rounded-2xl border-2 border-ink bg-white p-8 nb-shadow-lg">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-azure text-ink nb-shadow-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 21s-7-4.3-7-9a4 4 0 017-2.6A4 4 0 0119 12c0 4.7-7 9-7 9z"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h3 className="text-xl font-bold text-ink">Familias garantes</h3>
                <p className="text-sm font-medium text-ink/60">
                  Apoyas sin perder tu ahorro
                </p>
              </div>
            </div>
            <ul className="mt-6 space-y-4">
              {familias.map((b) => (
                <li key={b} className="flex gap-3 text-ink/80">
                  <Check />
                  <span className="text-sm font-medium leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
