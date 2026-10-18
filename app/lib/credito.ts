// Perfil crediticio de una dirección, leído en vivo del contrato `history`.
// Solo datos on-chain (sin datos personales): sirve al panel y al verificador público.
import "server-only";
import { HISTORY_ID, leerCredencial, leerPuntaje, leerRegistro } from "@/lib/soroban";

export type PerfilCrediticio = {
  address: string;
  puntaje: number;
  aTiempo: number;
  atrasadas: number;
  defaults: number;
  prestamosPagados: number;
  credencial: null | {
    emitida: string;
    actualizada: string;
    prestamosPagados: number;
    aTiempo: number;
    atrasadas: number;
    ultimoPrestamo: number;
  };
  contrato: string;
};

export async function perfilCrediticio(address: string): Promise<PerfilCrediticio> {
  const [puntaje, r, c] = await Promise.all([leerPuntaje(address), leerRegistro(address), leerCredencial(address)]);
  const iso = (s: bigint) => new Date(Number(s) * 1000).toISOString();
  return {
    address,
    puntaje,
    aTiempo: r.on_time,
    atrasadas: r.late,
    defaults: r.defaults,
    prestamosPagados: r.loans_repaid,
    credencial: c
      ? {
          emitida: iso(c.issued_at),
          actualizada: iso(c.updated_at),
          prestamosPagados: c.loans_repaid,
          aTiempo: c.on_time,
          atrasadas: c.late,
          ultimoPrestamo: Number(c.last_loan_id),
        }
      : null,
    contrato: HISTORY_ID,
  };
}

export const esDireccionStellar = (a: string) => /^G[A-Z2-7]{55}$/.test(a);
