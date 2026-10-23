// Mantiene vivos en la cadena los préstamos activos. En Soroban cada dato
// tiene una vida (TTL) en ledgers; si un préstamo en mora no se toca por
// mucho tiempo, se archiva y ya no se puede leer ni liquidar sin restaurarlo.
// El contrato extiende la vida al abrir y en cada pago; este módulo llama
// `bump(loan_id)` cuando a un préstamo activo le queda poca vida.
import "server-only";
import { Address, xdr } from "@stellar/stellar-sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LOAN_ID, arg, ejecutarComoServidor, operatorKeypair } from "@/lib/soroban";
import { conReintentos, rpcServer } from "@/lib/stellar";

const DIA_EN_LEDGERS = 17_280;
/** Se renueva cuando quedan menos de 7 días de vida. */
const UMBRAL = 7 * DIA_EN_LEDGERS;

export type ResultadoRenovacion = {
  revisados: number;
  renovados: number[];
  /** Préstamos ya archivados o sin entrada: requieren restaurarse a mano. */
  archivados: number[];
  errores: { loanId: number; error: string }[];
};

function llavePrestamo(loanId: number): xdr.LedgerKey {
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(LOAN_ID).toScAddress(),
      key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Loan"), xdr.ScVal.scvU64(BigInt(loanId))]),
      durability: xdr.ContractDataDurability.persistent,
    }),
  );
}

/** Ledger hasta el que vive cada préstamo (null si no hay entrada viva). */
async function vidaHasta(ids: number[]): Promise<Map<number, number | null>> {
  const r = await conReintentos(() => rpcServer().getLedgerEntries(...ids.map(llavePrestamo)));
  const porLlave = new Map(r.entries.map((e) => [e.key.toXDR("base64"), e.liveUntilLedgerSeq ?? null]));
  return new Map(ids.map((id) => [id, porLlave.get(llavePrestamo(id).toXDR("base64")) ?? null]));
}

export async function renovarPrestamos(): Promise<ResultadoRenovacion> {
  const { data, error } = await supabaseAdmin()
    .from("loans")
    .select("onchain_loan_id")
    .eq("status", "active")
    .eq("loan_contract_id", LOAN_ID);
  if (error) throw new Error(`loans: ${error.message}`);

  const ids = (data ?? []).map((l) => l.onchain_loan_id);
  const res: ResultadoRenovacion = { revisados: ids.length, renovados: [], archivados: [], errores: [] };
  if (!ids.length) return res;

  const { sequence } = await conReintentos(() => rpcServer().getLatestLedger());
  const vidas = await vidaHasta(ids);
  const operador = operatorKeypair();

  for (const id of ids) {
    const hasta = vidas.get(id) ?? null;
    if (hasta === null || hasta < sequence) {
      res.archivados.push(id);
      continue;
    }
    if (hasta - sequence >= UMBRAL) continue;
    try {
      const r = await ejecutarComoServidor(operador, LOAN_ID, "bump", [arg.u64(id)]);
      if (r.ok) res.renovados.push(id);
      else res.errores.push({ loanId: id, error: r.detail ?? "falló" });
    } catch (e) {
      res.errores.push({ loanId: id, error: (e as Error).message });
    }
  }
  if (res.archivados.length) console.warn("[renovacion] préstamos archivados:", res.archivados);
  return res;
}
