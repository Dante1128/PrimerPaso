"use client";

import { useRouter } from "next/navigation";
import SimuladorPrestamo from "@/components/SimuladorPrestamo";

export default function Simulador() {
  const router = useRouter();
  return (
    <section id="simulador" className="border-t-2 border-ink bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-block rotate-1 border-2 border-ink bg-lime px-3 py-1 text-sm font-bold uppercase tracking-wide text-ink nb-shadow-sm">Simulador</p>
          <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">Calcula tu primer crédito</h2>
          <p className="mt-4 text-lg font-medium text-ink/70">
            Elige cuánto necesitas y en cuántas cuotas: te mostramos la garantía, lo que recibes, el costo real y cómo
            recuperas tu ahorro.
          </p>
        </div>
        <div className="mt-14">
          <SimuladorPrestamo onUsar={() => router.push("/registro")} textoUsar="Crear mi cuenta" />
        </div>
      </div>
    </section>
  );
}
