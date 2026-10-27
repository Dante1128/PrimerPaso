"use client";
// Identidad rechazada: muestra el motivo y deja volver a enviarla sin salir del panel.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alerta, Boton } from "@/components/ui";
import { PasoKyc } from "@/components/registro/RegistroWizard";

export default function AvisoKycRechazado({ motivo }: { motivo: string | null }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  if (abierto) {
    return (
      <section className="nb-card p-5 sm:p-6">
        <PasoKyc titulo="Envía de nuevo tu identidad" onNext={() => router.refresh()} />
      </section>
    );
  }
  return (
    <Alerta tipo="error">
      <p className="font-bold">No pudimos verificar tu identidad.</p>
      <p className="mt-1">
        {motivo ? `Motivo: ${motivo}. ` : ""}Vuelve a enviarla para poder continuar con tu préstamo.
      </p>
      <Boton variant="secondary" className="mt-3" onClick={() => setAbierto(true)}>
        Enviar de nuevo
      </Boton>
    </Alerta>
  );
}
