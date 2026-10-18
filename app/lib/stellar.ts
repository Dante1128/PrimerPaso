// Helpers de Stellar del lado servidor (Testnet).
import {
  Horizon,
  Keypair,
  Networks,
  Asset,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? Networks.TESTNET;
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
export const FRIENDBOT_URL =
  process.env.NEXT_PUBLIC_FRIENDBOT_URL ?? "https://friendbot.stellar.org";

export const USDC_CODE = process.env.NEXT_PUBLIC_USDC_CODE ?? "USDC";
export const USDC_ISSUER = process.env.NEXT_PUBLIC_USDC_ISSUER ?? "";

export function horizon(): Horizon.Server {
  return new Horizon.Server(HORIZON_URL);
}

export function usdcAsset(): Asset {
  return new Asset(USDC_CODE, USDC_ISSUER);
}

/** Keypair del emisor del USDC de prueba (o null si no está configurado). */
export function issuerKeypair(): Keypair | null {
  const secret = process.env.STELLAR_ISSUER_SECRET;
  if (!secret) return null;
  return Keypair.fromSecret(secret);
}

/** Keypair del servidor que firma los challenges SEP-10. */
export function sep10ServerKeypair(): Keypair {
  const secret = process.env.SEP10_SERVER_SECRET;
  if (!secret) {
    throw new Error(
      "Falta SEP10_SERVER_SECRET en el .env (genera una llave con 'stellar keys generate').",
    );
  }
  return Keypair.fromSecret(secret);
}

/** Fondea una cuenta en Testnet con Friendbot (XLM). */
export async function fundWithFriendbot(
  address: string,
): Promise<{ ok: boolean; alreadyFunded?: boolean; detail?: string }> {
  const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`);
  if (res.ok) return { ok: true };
  const text = await res.text().catch(() => "");
  // Friendbot responde 400 si la cuenta ya existe.
  if (text.includes("op_already_exists") || text.includes("already funded")) {
    return { ok: true, alreadyFunded: true };
  }
  return { ok: false, detail: text.slice(0, 300) };
}

/** ¿La cuenta ya tiene trustline al USDC de prueba? */
export async function tieneTrustlineUsdc(address: string): Promise<boolean> {
  try {
    const acc = await horizon().loadAccount(address);
    return acc.balances.some(
      (b) =>
        "asset_code" in b &&
        b.asset_code === USDC_CODE &&
        "asset_issuer" in b &&
        b.asset_issuer === USDC_ISSUER,
    );
  } catch {
    return false;
  }
}

/** Saldo de USDC de una cuenta, en stroops (string). "0" si no tiene. */
export async function balanceUsdc(address: string): Promise<string> {
  try {
    const acc = await horizon().loadAccount(address);
    const b = acc.balances.find(
      (x) =>
        "asset_code" in x &&
        x.asset_code === USDC_CODE &&
        "asset_issuer" in x &&
        x.asset_issuer === USDC_ISSUER,
    );
    if (!b) return "0";
    // Horizon devuelve "123.4567890"; lo pasamos a stroops.
    return BigInt(Math.round(Number(b.balance) * 1e7)).toString();
  } catch {
    return "0";
  }
}

/** El emisor envía USDC de prueba a una cuenta (requiere trustline previa). */
export async function enviarUsdcDePrueba(
  destino: string,
  monto: string,
): Promise<{ ok: boolean; hash?: string; error?: string }> {
  const issuer = issuerKeypair();
  if (!issuer) {
    return { ok: false, error: "STELLAR_ISSUER_SECRET no configurado" };
  }
  try {
    const server = horizon();
    const cuenta = await server.loadAccount(issuer.publicKey());
    const tx = new TransactionBuilder(cuenta, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: destino,
          asset: usdcAsset(),
          amount: monto,
        }),
      )
      .setTimeout(60)
      .build();
    tx.sign(issuer);
    const res = await server.submitTransaction(tx);
    return { ok: true, hash: res.hash };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, error: err.message ?? "Error al enviar USDC" };
  }
}

/** Construye (sin firmar) la transacción de trustline al USDC de prueba.
 *  El cliente la firma con su wallet. Devuelve el XDR base64. */
export async function construirTrustlineXdr(account: string): Promise<string> {
  const server = horizon();
  const cuenta = await server.loadAccount(account);
  const tx = new TransactionBuilder(cuenta, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.changeTrust({ asset: usdcAsset() }))
    .setTimeout(120)
    .build();
  return tx.toXDR();
}

/** Envía una transacción firmada (XDR base64) a Horizon. */
export async function enviarXdrFirmado(
  xdr: string,
): Promise<{ ok: boolean; hash?: string; error?: string }> {
  try {
    const server = horizon();
    const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
    const res = await server.submitTransaction(tx);
    return { ok: true, hash: res.hash };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, error: err.message ?? "Error al enviar la transacción" };
  }
}
