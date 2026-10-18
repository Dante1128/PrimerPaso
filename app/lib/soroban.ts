// Capa de acceso a los contratos Soroban (lado servidor).
//
// Lecturas: se simulan por RPC (no requieren firma).
// Escrituras: se construyen y "preparan" (footprint + auth) en el servidor;
// el cliente las firma con su wallet y luego se envían.
import {
  rpc,
  Contract,
  Address,
  Keypair,
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
  BASE_FEE,
  Account,
  xdr,
} from "@stellar/stellar-sdk";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
  "Test SDF Network ; September 2015";

export const LOAN_ID = process.env.NEXT_PUBLIC_LOAN_CONTRACT_ID ?? "";
export const HISTORY_ID = process.env.NEXT_PUBLIC_HISTORY_CONTRACT_ID ?? "";
// Cuenta neutral solo para simular lecturas (no firma, no paga).
const READ_SOURCE = process.env.NEXT_PUBLIC_ADMIN_ADDRESS ?? "";

function server(): rpc.Server {
  return new rpc.Server(RPC_URL);
}

// ---------- conversión de argumentos ----------
export function argAddress(a: string): xdr.ScVal {
  return new Address(a).toScVal();
}
export function argI128(stroops: bigint): xdr.ScVal {
  return nativeToScVal(stroops, { type: "i128" });
}
export function argU32(n: number): xdr.ScVal {
  return nativeToScVal(n, { type: "u32" });
}

// ---------- lecturas (simulación) ----------
async function simular(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  const srv = server();
  const contract = new Contract(contractId);
  const source = new Account(READ_SOURCE, "0");
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  const sim = await srv.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulación falló (${method}): ${sim.error}`);
  }
  const retval = sim.result?.retval;
  if (!retval) return null;
  return scValToNative(retval);
}

/** Normaliza el enum de estado (puede venir como string o arreglo). */
function normalizarEstado(v: unknown): string {
  if (Array.isArray(v)) return String(v[0]);
  if (v && typeof v === "object" && "tag" in v) {
    return String((v as { tag: unknown }).tag);
  }
  return String(v);
}

export type Prestamo = {
  borrower: string;
  collateral: string;
  principal: string;
  totalDue: string;
  totalRepaid: string;
  collateralReleased: string;
  installments: number;
  installmentAmount: string;
  paidInstallments: number;
  interestRate: number;
  openedAt: number;
  period: number;
  status: string;
};

/** Lee el préstamo de una dirección (o null si no existe). */
export async function leerPrestamo(borrower: string): Promise<Prestamo | null> {
  const raw = (await simular(LOAN_ID, "get_loan", [argAddress(borrower)])) as
    | Record<string, unknown>
    | null;
  if (!raw) return null;
  const s = (k: string) => String(raw[k] ?? "0");
  const n = (k: string) => Number(raw[k] ?? 0);
  return {
    borrower: String(raw.borrower ?? borrower),
    collateral: s("collateral"),
    principal: s("principal"),
    totalDue: s("total_due"),
    totalRepaid: s("total_repaid"),
    collateralReleased: s("collateral_released"),
    installments: n("installments"),
    installmentAmount: s("installment_amount"),
    paidInstallments: n("paid_installments"),
    interestRate: n("interest_rate"),
    openedAt: Number(raw.opened_at ?? 0),
    period: Number(raw.period ?? 0),
    status: normalizarEstado(raw.status),
  };
}

/** Lee el puntaje crediticio de una dirección. */
export async function leerPuntaje(address: string): Promise<number> {
  const v = await simular(HISTORY_ID, "score", [argAddress(address)]);
  return Number(v ?? 500);
}

export type Credencial = {
  borrower: string;
  totalInstallments: number;
  onTime: number;
  late: number;
  issuedAt: number;
} | null;

/** Lee la credencial de buen pagador (o null si no existe). */
export async function leerCredencial(address: string): Promise<Credencial> {
  const raw = (await simular(HISTORY_ID, "get_credential", [
    argAddress(address),
  ])) as Record<string, unknown> | null;
  if (!raw) return null;
  return {
    borrower: String(raw.borrower ?? address),
    totalInstallments: Number(raw.total_installments ?? 0),
    onTime: Number(raw.on_time ?? 0),
    late: Number(raw.late ?? 0),
    issuedAt: Number(raw.issued_at ?? 0),
  };
}

export type RegistroHistorial = { onTime: number; late: number };

/** Lee el registro de pagos (a tiempo / atrasados). */
export async function leerRegistro(
  address: string,
): Promise<RegistroHistorial> {
  const raw = (await simular(HISTORY_ID, "get_record", [
    argAddress(address),
  ])) as Record<string, unknown> | null;
  return {
    onTime: Number(raw?.on_time ?? 0),
    late: Number(raw?.late ?? 0),
  };
}

// ---------- escrituras (preparar + enviar) ----------

/** Construye y prepara (footprint + auth) una invocación. Devuelve el XDR
 *  sin firmar, listo para que la wallet del `source` lo firme. */
export async function prepararInvocacion(
  source: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<string> {
  const srv = server();
  const contract = new Contract(contractId);
  const cuenta = await srv.getAccount(source);
  const tx = new TransactionBuilder(cuenta, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();

  const preparada = await srv.prepareTransaction(tx);
  return preparada.toXDR();
}

/** Keypair del admin (plataforma) para firmar liquidaciones en el servidor. */
export function adminKeypair(): Keypair | null {
  const s = process.env.STELLAR_ADMIN_SECRET;
  return s ? Keypair.fromSecret(s) : null;
}

/** Ejecuta una invocación firmada por el admin desde el servidor
 *  (p. ej. liquidate). Requiere STELLAR_ADMIN_SECRET. */
export async function ejecutarComoAdmin(
  method: string,
  args: xdr.ScVal[],
): Promise<{ ok: boolean; hash?: string; error?: string }> {
  const kp = adminKeypair();
  if (!kp) {
    return { ok: false, error: "STELLAR_ADMIN_SECRET no configurado" };
  }
  try {
    const srv = server();
    const contract = new Contract(LOAN_ID);
    const cuenta = await srv.getAccount(kp.publicKey());
    const tx = new TransactionBuilder(cuenta, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(120)
      .build();
    const preparada = await srv.prepareTransaction(tx);
    preparada.sign(kp);
    return await enviarInvocacion(preparada.toXDR());
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, error: err.message ?? "Error al ejecutar como admin" };
  }
}

/** ¿La próxima cuota impaga está vencida? (misma regla que el contrato). */
export function estaEnMora(p: {
  openedAt: number;
  period: number;
  paidInstallments: number;
  status: string;
}): boolean {
  if (p.status !== "Active") return false;
  const vencimiento = p.openedAt + (p.paidInstallments + 1) * p.period;
  return Math.floor(Date.now() / 1000) > vencimiento;
}

/** Envía una transacción Soroban ya firmada y espera el resultado. */
export async function enviarInvocacion(
  signedXdr: string,
): Promise<{ ok: boolean; hash?: string; error?: string }> {
  const srv = server();
  try {
    const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const sent = await srv.sendTransaction(tx);
    if (sent.status === "ERROR") {
      return { ok: false, error: "La red rechazó la transacción" };
    }
    // Esperamos la confirmación.
    let intento = 0;
    while (intento < 30) {
      const res = await srv.getTransaction(sent.hash);
      if (res.status === "SUCCESS") return { ok: true, hash: sent.hash };
      if (res.status === "FAILED") {
        return { ok: false, hash: sent.hash, error: "La transacción falló" };
      }
      await new Promise((r) => setTimeout(r, 1000));
      intento++;
    }
    return { ok: false, hash: sent.hash, error: "Tiempo de espera agotado" };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, error: err.message ?? "Error al enviar" };
  }
}
