"use client";
// Cliente de wallet (Stellar Wallets Kit, Freighter como principal).
import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import {
  FreighterModule,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit/modules/freighter";

const PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;

let inicializado = false;

function initKit() {
  if (inicializado) return;
  StellarWalletsKit.init({
    modules: [new FreighterModule()],
    selectedWalletId: FREIGHTER_ID,
    network: Networks.TESTNET,
  });
  inicializado = true;
}

/**
 * Conecta Freighter y devuelve la dirección pública (G...) de la cuenta
 * activa. Usa fetchAddress: pide permiso y la cuenta a la extensión
 * (getAddress solo lee la memoria del kit y falla si aún no hay conexión).
 */
export async function conectarFreighter(): Promise<string> {
  initKit();
  StellarWalletsKit.setWallet(FREIGHTER_ID);
  try {
    const { address } = await StellarWalletsKit.fetchAddress();
    if (!address) throw new Error();
    return address;
  } catch {
    throw new Error("No se pudo conectar Freighter. Ábrelo, desbloquéalo, elige la red Testnet y autoriza este sitio.");
  }
}

/** Firma un XDR con la wallet y devuelve el XDR firmado. */
export async function firmarXdr(xdr: string, address: string): Promise<string> {
  initKit();
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
    networkPassphrase: PASSPHRASE,
    address,
  });
  return signedTxXdr;
}
