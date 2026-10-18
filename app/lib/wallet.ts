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

/** Conecta Freighter y devuelve la dirección pública (G...). */
export async function conectarFreighter(): Promise<string> {
  initKit();
  StellarWalletsKit.setWallet(FREIGHTER_ID);
  const { address } = await StellarWalletsKit.getAddress();
  return address;
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
