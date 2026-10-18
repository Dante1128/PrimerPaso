"use client";

import { useRouter } from "next/navigation";
import SimuladorPrestamo from "@/components/SimuladorPrestamo";

export default function Simulador() {
  const router = useRouter();
  return (
    <section id="simulador" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Simulador</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Calcula tu primer crédito</h2>
          <p className="mt-4 text-lg text-slate-600">
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
