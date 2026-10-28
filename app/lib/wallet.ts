"use client";
// Integración directa con la API oficial de Freighter.
import { getNetwork, requestAccess, signTransaction } from "@stellar/freighter-api";

const PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "PUBLIC" ? "Public Global Stellar Network ; September 2015" : "Test SDF Network ; September 2015";

async function comprobarRed() {
  const red = await getNetwork();
  if (red.error) throw new Error("No se pudo leer la red de Freighter. Abre y desbloquea la extensión.");
  if (red.networkPassphrase !== PASSPHRASE) throw new Error(`En Freighter selecciona la red ${process.env.NEXT_PUBLIC_STELLAR_NETWORK === "PUBLIC" ? "Mainnet" : "Testnet"}.`);
}

/**
 * Conecta Freighter y devuelve la dirección pública (G...) de la cuenta
 * activa. Solicita permiso a la extensión y comprueba la red seleccionada.
 */
export async function conectarFreighter(): Promise<string> {
  const r = await requestAccess();
  if (r.error || !r.address) throw new Error("No se pudo conectar Freighter. Abre la extensión, desbloquéala y autoriza este sitio.");
  await comprobarRed();
  return r.address;
}

/** Firma un XDR con la wallet y devuelve el XDR firmado. */
export async function firmarXdr(xdr: string, address: string): Promise<string> {
  await comprobarRed();
  const r = await signTransaction(xdr, {
    networkPassphrase: PASSPHRASE,
    address,
  });
  if (r.error || !r.signedTxXdr) throw new Error("No se pudo firmar la transacción en Freighter.");
  if (r.signerAddress !== address) throw new Error("Freighter firmó con otra cuenta. Selecciona tu wallet vinculada.");
  return r.signedTxXdr;
}
