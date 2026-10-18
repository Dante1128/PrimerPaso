"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

const enlaces = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#simulador", label: "Simulador" },
  { href: "#faq", label: "Preguntas" },
];

export default function Navbar() {
  const [abierto, setAbierto] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-cream/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" aria-label="PrimerPaso, inicio">
          <Logo />
        </Link>

        {/* Enlaces de escritorio */}
        <div className="hidden items-center gap-8 md:flex">
          {enlaces.map((e) => (
            <a
              key={e.href}
              href={e.href}
              className="text-sm font-bold text-ink/70 transition hover:text-brandink"
            >
              {e.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/ingresar"
            className="text-sm font-bold text-ink/70 transition hover:text-brandink"
          >
            Ingresar
          </Link>
          <Link
            href="/registro"
            className="rounded-xl border-2 border-ink bg-brand px-4 py-2 text-sm font-bold text-white nb-shadow-sm nb-press"
          >
            Comenzar
          </Link>
        </div>

        {/* Botón móvil */}
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-lg border-2 border-ink bg-white text-ink nb-shadow-sm md:hidden"
          aria-label="Abrir menú"
          aria-expanded={abierto}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            {abierto ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </nav>

      {/* Menú móvil desplegable */}
      {abierto && (
        <div className="border-t-2 border-ink bg-cream md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
            {enlaces.map((e) => (
              <a
                key={e.href}
                href={e.href}
                onClick={() => setAbierto(false)}
                className="rounded-lg px-3 py-2 text-sm font-bold text-ink hover:bg-white"
              >
                {e.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
              <Link
                href="/ingresar"
                className="flex-1 rounded-xl border-2 border-ink bg-white px-4 py-2 text-center text-sm font-bold text-ink nb-shadow-sm"
              >
                Ingresar
              </Link>
              <Link
                href="/registro"
                className="flex-1 rounded-xl border-2 border-ink bg-brand px-4 py-2 text-center text-sm font-bold text-white nb-shadow-sm"
              >
                Comenzar
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
