const preguntas = [
  {
    q: "¿Qué es la garantía y por qué la bloqueo?",
    a: "Es un ahorro en USDC que bloqueas en un contrato inteligente. Sirve como respaldo del préstamo: nadie lo toca mientras pagas, y lo recuperas por completo al terminar. Es tuyo en todo momento.",
  },
  {
    q: "¿Cuánto puedo pedir prestado?",
    a: "Entre 100 y 3.000 USDC, hasta el 80% de la garantía que bloquees. Por ejemplo: bloqueas 1.250 USDC y pides 1.000; recibes 990 (la comisión de apertura es 1%) y pagas 8% anual sobre el saldo en hasta 12 cuotas.",
  },
  {
    q: "¿Qué pasa cuando pago una cuota?",
    a: "Cada cuota libera automáticamente una parte proporcional de tu garantía de vuelta a tu wallet y queda registrada como historial crediticio positivo, subiendo tu puntaje.",
  },
  {
    q: "¿Y si no llego a pagar?",
    a: "El contrato toma de tu garantía únicamente el monto adeudado y te devuelve el resto. Nunca pierdes más de lo que debes; tu familia garante tampoco.",
  },
  {
    q: "¿Necesito historial crediticio previo?",
    a: "No. PrimerPaso está pensado justamente para tu primer crédito: tu ahorro es el aval. A medida que pagas, construyes el historial que antes no tenías.",
  },
  {
    q: "¿Esto usa dinero real?",
    a: "No. El MVP funciona sobre la red de pruebas de Stellar (Testnet) con USDC de prueba. Es una demostración segura, sin valor monetario real.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="border-t-2 border-ink bg-cream py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="inline-block -rotate-1 border-2 border-ink bg-grape px-3 py-1 text-sm font-bold uppercase tracking-wide text-ink nb-shadow-sm">
            Preguntas frecuentes
          </p>
          <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">
            Lo que debes saber
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {preguntas.map((p) => (
            <details
              key={p.q}
              className="group rounded-xl border-2 border-ink bg-white p-5 nb-shadow-sm [&_svg]:open:rotate-45"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-ink">
                {p.q}
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="shrink-0 rounded-md border-2 border-ink bg-sun p-0.5 text-ink transition-transform"
                >
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </summary>
              <p className="mt-3 text-sm font-medium leading-relaxed text-ink/70">
                {p.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
