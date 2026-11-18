// En qué paso del camino está el estudiante y qué le toca hacer ahora.
// Identidad → Solicitud → Garantía → Firma → Pagos.

export type EstadoPaso = "hecho" | "actual" | "revision" | "pendiente";
export type PasoCamino = { id: "identidad" | "solicitud" | "garantia" | "firma" | "pagos"; txt: string; estado: EstadoPaso };

export type DatosCamino = {
  kycStatus: string | null;
  /** Solicitud en revisión ("submitted") o aprobada ("approved"), si hay. */
  solicitud: { status: string; garantiaDepositada?: boolean; garantia: number } | null;
  tienePrestamoActivo: boolean;
  /** Ya terminó de pagar un préstamo y no tiene otro en curso. */
  terminoDePagar: boolean;
};

const NOMBRES: [PasoCamino["id"], string][] = [
  ["identidad", "Identidad"],
  ["solicitud", "Solicitud"],
  ["garantia", "Garantía"],
  ["firma", "Firma"],
  ["pagos", "Pagos"],
];

const usd = (n: number) => `${new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 }).format(n)} USDC`;

export function caminoEstudiante(d: DatosCamino): { pasos: PasoCamino[]; ahora: string } {
  let actual: number;
  let ahora: string;

  if (d.tienePrestamoActivo) {
    actual = 4;
    ahora = "Paga tus cuotas a tiempo: cada pago te devuelve una parte de tu garantía.";
  } else if (d.solicitud?.status === "approved") {
    actual = d.solicitud.garantiaDepositada ? 3 : 2;
    ahora = d.solicitud.garantiaDepositada
      ? "Firma el préstamo para recibir el dinero en tu wallet."
      : `Bloquea ${usd(d.solicitud.garantia)} de garantía (tú o tu garante).`;
  } else if (d.solicitud?.status === "submitted") {
    actual = 1;
    ahora = "Tu solicitud está en revisión, normalmente en menos de 24 h. Mientras tanto, consigue la garantía o invita a tu garante.";
  } else if (d.kycStatus === "rejected") {
    actual = 0;
    ahora = "Vuelve a enviar tu identidad para continuar.";
  } else if (d.terminoDePagar) {
    return {
      pasos: NOMBRES.map(([id, txt]) => ({ id, txt, estado: "hecho" })),
      ahora: "Terminaste de pagar. Si quieres, puedes pedir un nuevo préstamo.",
    };
  } else {
    actual = 1;
    ahora =
      d.kycStatus === "approved"
        ? "Simula tu préstamo y envía tu solicitud."
        : "Estamos verificando tu identidad. Mientras tanto ya puedes simular y enviar tu solicitud.";
  }

  const pasos = NOMBRES.map(([id, txt], i): PasoCamino => {
    // La identidad puede seguir en revisión aunque ya hayas enviado la solicitud.
    if (id === "identidad" && d.kycStatus !== "approved") {
      return { id, txt, estado: d.kycStatus === "rejected" ? "actual" : "revision" };
    }
    if (id === "solicitud" && d.solicitud?.status === "submitted") return { id, txt, estado: "revision" };
    return { id, txt, estado: i < actual ? "hecho" : i === actual ? "actual" : "pendiente" };
  });
  return { pasos, ahora };
}
