import Logo from "@/components/Logo";

export default function Footer() {
  return (
    <footer className="border-t-2 border-ink bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-ink/60">
              Créditos para estudiantes universitarios en Bolivia respaldados
              por tu ahorro en USDC. Construido sobre Stellar y Soroban.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-sun px-3 py-1 text-xs font-bold text-ink">
              <span className="h-2 w-2 rounded-full bg-ink" />
              Demo en Stellar Testnet · sin dinero real
            </span>
          </div>

          <div>
            <h4 className="text-sm font-bold text-ink">Plataforma</h4>
            <ul className="mt-3 space-y-2 text-sm font-medium text-ink/60">
              <li>
                <a href="#como-funciona" className="hover:text-brandink">
                  Cómo funciona
                </a>
              </li>
              <li>
                <a href="#beneficios" className="hover:text-brandink">
                  Beneficios
                </a>
              </li>
              <li>
                <a href="#simulador" className="hover:text-brandink">
                  Simulador
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-brandink">
                  Preguntas frecuentes
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-ink">Cuenta</h4>
            <ul className="mt-3 space-y-2 text-sm font-medium text-ink/60">
              <li>
                <a href="/registro" className="hover:text-brandink">
                  Crear cuenta
                </a>
              </li>
              <li>
                <a href="/ingresar" className="hover:text-brandink">
                  Ingresar
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t-2 border-ink/10 pt-6 text-sm font-medium text-ink/50 sm:flex-row">
          <p>© 2026 PrimerPaso. Proyecto educativo.</p>
          <p>Hecho con Stellar · Soroban · Next.js</p>
        </div>
      </div>
    </footer>
  );
}
