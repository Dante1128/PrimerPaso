const pasos = [
  {
    n: 1,
    titulo: "Depositas tu ahorro",
    texto:
      "Bloqueas USDC como garantía en un contrato Soroban. Tú o un familiar garante pueden aportarlo. Nadie más puede tocarlo.",
    icono: (
      <path
        d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    n: 2,
    titulo: "Recibes tu préstamo",
    texto:
      "Obtienes al instante un crédito por el 80% de tu garantía, directo en tu wallet. Sin papeleo ni historial previo.",
    icono: (
      <path
        d="M3 8h18v10H3zM3 8l3-4h12l3 4M8 13h.01M12 13h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    n: 3,
    titulo: "Pagas y liberas",
    texto:
      "Cada cuota que pagas libera automáticamente una parte proporcional de tu garantía y queda registrada en tu historial.",
    icono: (
      <path
        d="M9 12l2 2 4-4m-3-7a9 9 0 110 18 9 9 0 010-18z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    n: 4,
    titulo: "Recuperas tu ahorro",
    texto:
      "Al terminar de pagar, recuperas el 100% de tu garantía y recibes una credencial de buen pagador verificable on-chain.",
    icono: (
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6zm0 0v6m-7-9a7 7 0 1114 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export default function ComoFunciona() {
  return (
    <section id="como-funciona" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
            Cómo funciona
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Cuatro pasos simples
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Tu ahorro nunca se pierde: trabaja como respaldo mientras construyes
            tu reputación crediticia.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pasos.map((p, i) => (
            <div key={p.n} className="relative">
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-200 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-600">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      {p.icono}
                    </svg>
                  </span>
                  <span className="text-sm font-bold text-slate-300">
                    0{p.n}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  {p.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {p.texto}
                </p>
              </div>
              {i < pasos.length - 1 && (
                <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-teal-300 lg:block">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
