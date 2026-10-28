// Helpers de Stellar del lado servidor (Testnet), solo con Stellar RPC.
import "server-only";
import {
  Account,
  Asset,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  type xdr,
} from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
export const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";

export const USDC_CONTRACT_ID = process.env.NEXT_PUBLIC_USDC_CONTRACT_ID ?? "";

let servidor: rpc.Server | null = null;
export function rpcServer(): rpc.Server {
  servidor ??= new rpc.Server(RPC_URL);
  return servidor;
}

/** Keypair del servidor que firma los challenges SEP-10. */
export function sep10ServerKeypair(): Keypair {
  const secret = process.env.SEP10_SERVER_SECRET;
  if (!secret) throw new Error("Falta SEP10_SERVER_SECRET en .env.local");
  return Keypair.fromSecret(secret);
}

/** Keypair del emisor del USDC de prueba (solo testnet; null si no está). */
function issuerKeypair(): Keypair | null {
  const secret = process.env.USDC_ISSUER_SECRET;
  return secret ? Keypair.fromSecret(secret) : null;
}

/**
 * Simula una llamada de solo lectura a un contrato y devuelve el valor
 * nativo. No firma ni envía nada.
 */
export async function simularLectura(contractId: string, metodo: string, args: xdr.ScVal[] = []) {
  const fuente = new Account(sep10ServerKeypair().publicKey(), "0");
  const tx = new TransactionBuilder(fuente, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(contractId).call(metodo, ...args))
    .setTimeout(30)
    .build();
  const sim = await conReintentos(() => rpcServer().simulateTransaction(tx));
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error(`Lectura ${metodo} falló`);
  }
  return scValToNative(sim.result.retval);
}

let assetCache: Asset | null = null;
/** El asset clásico detrás del contrato USDC (el SAC responde "USDC:G..."). */
export async function usdcAsset(): Promise<Asset> {
  if (!assetCache) {
    const nombre = String(await simularLectura(USDC_CONTRACT_ID, "name"));
    const [code, issuer] = nombre.split(":");
    assetCache = new Asset(code, issuer);
  }
  return assetCache;
}

/** Saldo USDC en stroops (7 decimales). 0 si no tiene trustline. */
export async function balanceUsdc(address: string): Promise<bigint> {
  try {
    const v = await simularLectura(USDC_CONTRACT_ID, "balance", [nativeToScVal(address, { type: "address" })]);
    return BigInt(v as bigint);
  } catch {
    return BigInt(0);
  }
}

/** ¿La cuenta puede recibir USDC? (tiene trustline). */
export async function tieneTrustlineUsdc(address: string): Promise<boolean> {
  try {
    await simularLectura(USDC_CONTRACT_ID, "balance", [nativeToScVal(address, { type: "address" })]);
    return true;
  } catch {
    return false;
  }
}

/** Fondea una cuenta en Testnet con Friendbot (XLM). */
export async function fundWithFriendbot(address: string): Promise<{ ok: boolean; detail?: string }> {
  const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`);
  if (res.ok) return { ok: true };
  const text = await res.text().catch(() => "");
  // Friendbot responde 400 si la cuenta ya existe: no es un error para nosotros.
  if (/already|op_already_exists|createAccountAlreadyExist/i.test(text)) return { ok: true };
  return { ok: false, detail: text.slice(0, 300) };
}

/** XDR (sin firmar) de la trustline al USDC, para firmar con la wallet. */
export async function construirTrustlineXdr(address: string): Promise<string> {
  const cuenta = await conReintentos(() => rpcServer().getAccount(address));
  return new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset: await usdcAsset() }))
    .setTimeout(300)
    .build()
    .toXDR();
}

/** Envía un XDR ya firmado y espera el resultado. */
export async function enviarXdrFirmado(xdrFirmado: string): Promise<{ ok: boolean; hash?: string; detail?: string }> {
  const tx = TransactionBuilder.fromXDR(xdrFirmado, NETWORK_PASSPHRASE);
  return enviarYEsperar(tx);
}

/** Envía USDC de prueba desde el emisor (acuña). Solo testnet. */
export async function enviarUsdcDePrueba(destino: string, monto: string) {
  if (NETWORK_PASSPHRASE === Networks.PUBLIC) return { ok: false, detail: "El faucet solo está disponible en testnet" };
  const issuer = issuerKeypair();
  if (!issuer) return { ok: false, detail: "Falta USDC_ISSUER_SECRET (faucet de testnet)" };
  const cuenta = await conReintentos(() => rpcServer().getAccount(issuer.publicKey()));
  const tx = new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.payment({ destination: destino, asset: await usdcAsset(), amount: monto }))
    .setTimeout(60)
    .build();
  tx.sign(issuer);
  return enviarYEsperar(tx);
}

const esperar = (ms: number) => new Promise((s) => setTimeout(s, ms));

/** ¿Error pasajero de red o del RPC (5xx, timeout)? */
function esPasajero(e: unknown): boolean {
  const m = String((e as Error)?.message ?? e);
  return /status code 5\d\d|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|network|fetch failed|timeout/i.test(m);
}

/** Reintenta una llamada al RPC ante errores pasajeros (no ante errores del contrato). */
export async function conReintentos<T>(fn: () => Promise<T>, intentos = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= intentos || !esPasajero(e)) throw e;
      await esperar(800 * i);
    }
  }
}

/**
 * Envía la transacción y espera su resultado. El hash se calcula localmente:
 * si el RPC falla al enviar o al consultar, se sigue consultando por hash
 * (la transacción pudo haber entrado igual) en vez de reportar un falso error.
 */
export async function enviarYEsperar(
  tx: ReturnType<typeof TransactionBuilder.fromXDR>,
): Promise<{ ok: boolean; hash?: string; detail?: string; returnValue?: unknown }> {
  const server = rpcServer();
  const hash = Buffer.from(tx.hash()).toString("hex");
  try {
    const enviado = await server.sendTransaction(tx);
    if (enviado.status === "ERROR") return { ok: false, hash, detail: "La red rechazó la transacción" };
  } catch (e) {
    if (!esPasajero(e)) throw e;
    // Pudo haber llegado: seguimos consultando por hash.
  }

  for (let i = 0; i < 40; i++) {
    try {
      const r = await server.getTransaction(hash);
      if (r.status === "SUCCESS") {
        return { ok: true, hash, returnValue: r.returnValue ? scValToNative(r.returnValue) : undefined };
      }
      if (r.status === "FAILED") return { ok: false, hash, detail: "La transacción falló en la red" };
    } catch (e) {
      if (!esPasajero(e)) throw e;
    }
    await esperar(1000);
  }
  return { ok: false, hash, detail: "La red no confirmó a tiempo; revisa el enlace antes de reintentar" };
}

/** Link a stellar.expert para una transacción. */
export function linkTx(hash: string): string {
  const red = NETWORK_PASSPHRASE === Networks.PUBLIC ? "public" : "testnet";
  return `https://stellar.expert/explorer/${red}/tx/${hash}`;
}
