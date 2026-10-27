const pasos = [
  {
    n: 1,
    color: "bg-sun",
    titulo: "Depositas tu ahorro",
    texto:
      "Bloqueas USDC como garantía en un contrato público en la red Stellar. Tú o un familiar garante pueden aportarlo. Nadie puede usarlo mientras pagas a tiempo.",
    icono: (
      <path
        d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    n: 2,
    color: "bg-azure",
    titulo: "Recibes tu préstamo",
    texto:
      "Cuando aprobamos tu solicitud, recibes un crédito de hasta el 80% de tu garantía, directo en tu wallet. Sin historial previo.",
    icono: (
      <path
        d="M3 8h18v10H3zM3 8l3-4h12l3 4M8 13h.01M12 13h4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    n: 3,
    color: "bg-coral",
    titulo: "Pagas y liberas",
    texto:
      "Cada cuota que pagas libera automáticamente una parte proporcional de tu garantía y queda registrada en tu historial.",
    icono: (
      <path
        d="M9 12l2 2 4-4m-3-7a9 9 0 110 18 9 9 0 010-18z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    n: 4,
    color: "bg-lime",
    titulo: "Recuperas tu ahorro",
    texto:
      "Al terminar de pagar, recuperas el 100% de tu garantía y recibes una credencial de buen pagador que cualquiera puede verificar.",
    icono: (
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6zm0 0v6m-7-9a7 7 0 1114 0"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export default function ComoFunciona() {
  return (
    <section id="como-funciona" className="border-y-2 border-ink bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-block -rotate-1 border-2 border-ink bg-sun px-3 py-1 text-sm font-bold uppercase tracking-wide text-ink nb-shadow-sm">
            Cómo funciona
          </p>
          <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">
            Cuatro pasos simples
          </h2>
          <p className="mt-4 text-lg font-medium text-ink/70">
            Tu ahorro vuelve a ti a medida que pagas. Si no pagas, solo se cobra
            lo que debes y el resto también vuelve a ti.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pasos.map((p) => (
            <div
              key={p.n}
              className="h-full rounded-2xl border-2 border-ink bg-cream p-6 nb-shadow nb-press"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`grid h-12 w-12 place-items-center rounded-xl border-2 border-ink ${p.color} text-ink nb-shadow-sm`}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    {p.icono}
                  </svg>
                </span>
                <span className="text-3xl font-bold text-ink/15">0{p.n}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink">{p.titulo}</h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-ink/70">
                {p.texto}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
