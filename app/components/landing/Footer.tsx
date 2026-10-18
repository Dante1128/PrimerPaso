import Logo from "@/components/Logo";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500">
              Créditos para estudiantes universitarios en Bolivia respaldados
              por tu ahorro en USDC. Construido sobre Stellar y Soroban.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Demo en Stellar Testnet · sin dinero real
            </span>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900">Plataforma</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li>
                <a href="#como-funciona" className="hover:text-teal-600">
                  Cómo funciona
                </a>
              </li>
              <li>
                <a href="#beneficios" className="hover:text-teal-600">
                  Beneficios
                </a>
              </li>
              <li>
                <a href="#simulador" className="hover:text-teal-600">
                  Simulador
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-teal-600">
                  Preguntas frecuentes
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900">Cuenta</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li>
                <a href="/registro" className="hover:text-teal-600">
                  Crear cuenta
                </a>
              </li>
              <li>
                <a href="/ingresar" className="hover:text-teal-600">
                  Ingresar
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 text-sm text-slate-400 sm:flex-row">
          <p>© 2026 PrimerPaso. Proyecto educativo.</p>
          <p>Hecho con Stellar · Soroban · Next.js</p>
        </div>
      </div>
    </footer>
  );
}
