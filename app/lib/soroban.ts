// Contratos de PrimerPaso (loan, history) vía Stellar RPC — lado servidor.
//
// Dos formas de invocar:
//  - prepararParaWallet: arma la transacción con el usuario como fuente,
//    firma en el servidor las autorizaciones de las cuentas de la
//    plataforma (operator/admin) y devuelve el XDR para que el usuario lo
//    firme con su wallet. Ej.: open_loan (operator + estudiante).
//  - ejecutarComoServidor: la plataforma firma y envía sola. Ej.: liquidate.
import "server-only";
import {
  Contract,
  Keypair,
  Operation,
  TransactionBuilder,
  authorizeEntry,
  nativeToScVal,
  rpc,
  type xdr,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, conReintentos, enviarYEsperar, rpcServer, simularLectura } from "@/lib/stellar";

export const LOAN_ID = process.env.NEXT_PUBLIC_LOAN_CONTRACT_ID ?? "";
export const HISTORY_ID = process.env.NEXT_PUBLIC_HISTORY_CONTRACT_ID ?? "";

/** Unidad mínima de USDC (7 decimales). */
export const STROOPS = BigInt(10_000_000);
export const aStroops = (usdc: number | string) => BigInt(Math.round(Number(usdc) * 1e7));
export const aUsdc = (stroops: bigint | string | number) => Number(BigInt(stroops)) / 1e7;

// --- Argumentos ---
export const arg = {
  address: (a: string) => nativeToScVal(a, { type: "address" }),
  i128: (v: bigint) => nativeToScVal(v, { type: "i128" }),
  u32: (v: number) => nativeToScVal(v, { type: "u32" }),
  u64: (v: bigint | number) => nativeToScVal(BigInt(v), { type: "u64" }),
  bool: (v: boolean) => nativeToScVal(v),
};

// --- Cuentas de la plataforma ---
function llave(nombre: "ADMIN_SECRET_KEY" | "OPERATOR_SECRET_KEY"): Keypair {
  const s = process.env[nombre];
  if (!s) throw new Error(`Falta ${nombre} en .env.local`);
  return Keypair.fromSecret(s);
}
export const operatorKeypair = () => llave("OPERATOR_SECRET_KEY");
export const adminKeypair = () => llave("ADMIN_SECRET_KEY");

// --- Tipos que devuelve el contrato loan ---
export type LoanParams = {
  max_ltv_bps: number;
  rate_bps: number;
  origination_fee_bps: number;
  late_fee_bps: number;
  yield_share_platform_bps: number;
  grace_seconds: bigint;
  min_principal: bigint;
  max_principal: bigint;
  max_installments: number;
};

export type LoanOnchain = {
  id: bigint;
  position_id: bigint;
  borrower: string;
  depositor: string;
  principal: bigint;
  origination_fee: bigint;
  disbursed: bigint;
  principal_paid: bigint;
  interest_accrued: bigint;
  interest_paid: bigint;
  collateral_initial: bigint;
  collateral_released: bigint;
  installments: number;
  installments_paid: number;
  first_due_ts: bigint;
  period_seconds: bigint;
  opened_at: bigint;
  status: "Active" | "Repaid" | "Liquidated";
  terms: { rate_bps: number; late_fee_bps: number; grace_seconds: bigint; max_ltv_bps: number; origination_fee_bps: number };
};

export type PaymentQuote = {
  interest_due: bigint;
  principal_outstanding: bigint;
  next_installment_principal: bigint;
  next_due_ts: bigint;
  overdue_amount: bigint;
  overdue: boolean;
  liquidatable: boolean;
  late_fee: bigint;
};

/** Los enums de Soroban llegan como ["Active"]; los dejamos como "Active". */
function normalizarEnum<T extends { status: unknown }>(v: T): T {
  const s = v.status;
  return { ...v, status: Array.isArray(s) ? s[0] : s };
}

// --- Lecturas ---
export const leerParams = async () => (await simularLectura(LOAN_ID, "get_params")) as LoanParams;

export async function leerPrestamo(loanId: bigint | number): Promise<LoanOnchain | null> {
  const v = (await simularLectura(LOAN_ID, "get_loan", [arg.u64(loanId)])) as LoanOnchain | undefined;
  return v ? normalizarEnum(v) : null;
}

/** Cotización de la próxima cuota (solo para préstamos activos). */
export async function cotizarPago(loanId: bigint | number): Promise<PaymentQuote | null> {
  try {
    return (await simularLectura(LOAN_ID, "quote_next_payment", [arg.u64(loanId)])) as PaymentQuote;
  } catch {
    return null;
  }
}

export async function leerPosicion(positionId: bigint | number) {
  const v = (await simularLectura(LOAN_ID, "get_position", [arg.u64(positionId)])) as
    | { id: bigint; depositor: string; borrower: string; amount: bigint; locked: bigint; loan_id?: bigint; status: string | string[] }
    | undefined;
  return v ? normalizarEnum(v) : null;
}

export const poolDisponible = async () => BigInt((await simularLectura(LOAN_ID, "pool_available")) as bigint);

export const leerPuntaje = async (address: string) =>
  Number(await simularLectura(HISTORY_ID, "get_score", [arg.address(address)]));

export async function leerCredencial(address: string) {
  return (await simularLectura(HISTORY_ID, "get_credential", [arg.address(address)])) as
    | { borrower: string; loans_repaid: number; on_time: number; late: number; last_loan_id: bigint; issued_at: bigint; updated_at: bigint }
    | undefined;
}

export const leerRegistro = async (address: string) =>
  (await simularLectura(HISTORY_ID, "get_record", [arg.address(address)])) as {
    on_time: number;
    late: number;
    defaults: number;
    loans_repaid: number;
  };

// --- Escrituras ---

/** Dirección (G...) que debe firmar una entrada de autorización. */
function firmanteDe(entrada: xdr.SorobanAuthorizationEntry): string | null {
  const j = JSON.parse(
    JSON.stringify((entrada as unknown as { credentials: unknown }).credentials, (_k, v) =>
      typeof v === "bigint" ? String(v) : v,
    ),
  );
  const nodo = j?.address ?? j?.address_v2 ?? j?.address_with_delegates;
  return typeof nodo?.address === "string" ? nodo.address : null;
}

async function simular(fuente: string, contractId: string, metodo: string, args: xdr.ScVal[]) {
  const server = rpcServer();
  const cuenta = await conReintentos(() => server.getAccount(fuente));
  const tx = new TransactionBuilder(cuenta, { fee: "1000000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(contractId).call(metodo, ...args))
    .setTimeout(300)
    .build();
  const sim = await conReintentos(() => server.simulateTransaction(tx));
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new ErrorContrato(rpc.Api.isSimulationError(sim) ? sim.error : "La simulación falló");
  }
  return { tx, sim };
}

/** Error de un contrato con el mensaje traducido para el usuario. */
export class ErrorContrato extends Error {
  constructor(crudo: string) {
    super(traducirError(crudo));
  }
}

const ERRORES_LOAN: Record<number, string> = {
  3: "La plataforma está en pausa.",
  4: "No tienes permiso para esta operación.",
  5: "La posición de garantía no existe.",
  6: "El préstamo no existe.",
  7: "La operación no es válida en el estado actual.",
  8: "El monto supera el 80% de la garantía.",
  9: "Monto o número de cuotas fuera de los límites.",
  10: "Parámetros inválidos.",
  11: "Monto inválido.",
  12: "El pago supera lo adeudado.",
  13: "Primero debes pagar el interés pendiente.",
  14: "El préstamo aún no está en mora (o la gracia no terminó).",
  15: "El pool no tiene liquidez suficiente.",
  16: "La operación rompería la garantía mínima.",
};

function traducirError(crudo: string): string {
  const m = crudo.match(/Error\(Contract, #(\d+)\)/);
  if (m) return ERRORES_LOAN[Number(m[1])] ?? `Error del contrato #${m[1]}`;
  if (/balance is not sufficient|resulting balance is not within/i.test(crudo)) return "Saldo de USDC insuficiente.";
  if (/trustline entry is missing/i.test(crudo)) return "Tu cuenta no tiene trustline al USDC.";
  if (/Account not found|does not exist/i.test(crudo)) return "La cuenta no existe en la red (fondéala primero).";
  return "La transacción no se pudo simular.";
}

/**
 * Arma una invocación con `fuente` (la wallet del usuario) como cuenta
 * fuente, firma las autorizaciones de `firmantesServidor` y devuelve el XDR
 * listo para que el usuario lo firme con su wallet.
 */
export async function prepararParaWallet(
  fuente: string,
  contractId: string,
  metodo: string,
  args: xdr.ScVal[],
  firmantesServidor: Keypair[] = [],
): Promise<string> {
  const { tx, sim } = await simular(fuente, contractId, metodo, args);
  const { sequence } = await conReintentos(() => rpcServer().getLatestLedger());
  const porDireccion = new Map(firmantesServidor.map((k) => [k.publicKey(), k]));

  const auth = await Promise.all(
    (sim.result?.auth ?? []).map((entrada) => {
      const kp = porDireccion.get(firmanteDe(entrada) ?? "");
      return kp ? authorizeEntry(entrada, kp, sequence + 200, NETWORK_PASSPHRASE) : entrada;
    }),
  );
  const op = tx.operations[0] as Operation.InvokeHostFunction;
  return rpc
    .assembleTransaction(tx, sim)
    .clearOperations()
    .addOperation(Operation.invokeHostFunction({ source: op.source, func: op.func, auth }))
    .build()
    .toXDR();
}

/** La plataforma firma y envía la invocación (fuente = `keypair`). */
export async function ejecutarComoServidor(keypair: Keypair, contractId: string, metodo: string, args: xdr.ScVal[]) {
  const { tx, sim } = await simular(keypair.publicKey(), contractId, metodo, args);
  const listo = rpc.assembleTransaction(tx, sim).build();
  listo.sign(keypair);
  return enviarYEsperar(listo);
}

/**
 * Verifica que un XDR firmado por el usuario sea exactamente una invocación
 * de `metodo` en `contractId` desde `fuente`, antes de enviarlo.
 */
export function validarXdr(xdrFirmado: string, contractId: string, metodo: string, fuente: string) {
  const tx = TransactionBuilder.fromXDR(xdrFirmado, NETWORK_PASSPHRASE);
  if ("innerTransaction" in tx) throw new Error("Transacción no soportada");
  if (tx.source !== fuente) throw new Error("La transacción no la firma tu wallet");
  if (tx.operations.length !== 1 || tx.operations[0].type !== "invokeHostFunction") {
    throw new Error("Transacción inesperada");
  }
  const j = JSON.stringify((tx.operations[0] as Operation.InvokeHostFunction).func, (_k, v) =>
    typeof v === "bigint" ? String(v) : v,
  );
  if (!j.includes(contractId) || !j.includes(`"${metodo}"`)) {
    throw new Error("La transacción no corresponde a esta operación");
  }
  return tx;
}
