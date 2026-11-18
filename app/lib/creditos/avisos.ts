// Texto de cada aviso (tabla notifications) en palabras simples, con el siguiente paso.

export type Aviso = { type: string; payload: Record<string, unknown> | null };

const conMotivo = (p: Aviso["payload"]) => (p?.reason ? ` Motivo: ${String(p.reason)}.` : "");

export function textoAviso(n: Aviso): string {
  switch (n.type) {
    case "kyc_approved":
      return "Tu identidad fue aprobada. Ya puedes pedir tu préstamo.";
    case "kyc_rejected":
      return `No pudimos verificar tu identidad.${conMotivo(n.payload)} Vuelve a enviarla desde tu panel.`;
    case "application_approved":
      return "Tu solicitud fue aprobada. Ahora bloquea la garantía para recibir el dinero.";
    case "application_rejected":
      return `Tu solicitud fue rechazada.${conMotivo(n.payload)} Puedes enviar una nueva.`;
    case "loan_liquidated":
      return `Tu préstamo #${String(n.payload?.loan_id ?? "")} no se pagó a tiempo y se cobró lo que debías de la garantía. El resto volvió a la wallet de quien la depositó.`;
    default:
      return "Tienes una novedad en tu panel.";
  }
}
