// Mantiene vivos en la cadena los préstamos activos. En Soroban cada dato
// tiene una vida (TTL) en ledgers; si un préstamo en mora no se toca por
// mucho tiempo, se archiva y ya no se puede leer ni liquidar sin restaurarlo.
// El contrato extiende la vida al abrir y en cada pago; este módulo llama
// `bump(loan_id)` cuando a un préstamo activo le queda poca vida.
import "server-only";
import { Address, xdr } from "@stellar/stellar-sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HISTORY_ID, LOAN_ID, arg, ejecutarComoServidor, operatorKeypair } from "@/lib/soroban";
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
  const porLlave = new Map<string, number | null>();
  for (let i = 0; i < ids.length; i += 50) {
    const r = await conReintentos(() => rpcServer().getLedgerEntries(...ids.slice(i, i + 50).map(llavePrestamo)));
    for (const e of r.entries) porLlave.set(e.key.toXDR("base64"), e.liveUntilLedgerSeq ?? null);
  }
  return new Map(ids.map((id) => [id, porLlave.get(llavePrestamo(id).toXDR("base64")) ?? null]));
}

export async function renovarPrestamos(): Promise<ResultadoRenovacion> {
  const ids: number[] = [];
  for (let desde = 0; ; desde += 500) {
    const { data, error } = await supabaseAdmin().from("loans").select("onchain_loan_id")
      .eq("status", "active").eq("loan_contract_id", LOAN_ID).order("onchain_loan_id").range(desde, desde + 499);
    if (error) throw new Error(`loans: ${error.message}`);
    ids.push(...data.map((l) => l.onchain_loan_id));
    if (data.length < 500) break;
  }
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

/** Mantiene el historial también después del último préstamo. Requiere history.bump. */
export async function renovarHistoriales() {
  const res = { revisados: 0, renovados: [] as string[], archivados: [] as string[], errores: [] as { address: string; error: string }[] };
  const { sequence } = await conReintentos(() => rpcServer().getLatestLedger());
  const operador = operatorKeypair();
  for (let desde = 0; ; desde += 100) {
    const { data, error } = await supabaseAdmin().from("credit_profiles").select("borrower_address, credential_id")
      .order("profile_id").range(desde, desde + 99);
    if (error) throw new Error(error.message);
    for (const perfil of data) {
      const address = perfil.borrower_address;
      res.revisados++;
      const claves = ["Record", ...(perfil.credential_id ? ["Credential"] : [])].map((tipo) =>
        xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
          contract: new Address(HISTORY_ID).toScAddress(),
          key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(tipo), new Address(address).toScVal()]),
          durability: xdr.ContractDataDurability.persistent,
        })),
      );
      try {
        const r = await conReintentos(() => rpcServer().getLedgerEntries(...claves));
        if (r.entries.length !== claves.length) { res.archivados.push(address); continue; }
        if (r.entries.every((e) => (e.liveUntilLedgerSeq ?? 0) - sequence >= UMBRAL)) continue;
        const renovado = await ejecutarComoServidor(operador, HISTORY_ID, "bump", [arg.address(address)]);
        if (!renovado.ok) throw new Error(renovado.detail ?? "No se pudo renovar el historial");
        res.renovados.push(address);
      } catch (e) { res.errores.push({ address, error: (e as Error).message }); }
    }
    if (data.length < 100) break;
  }
  return res;
}
