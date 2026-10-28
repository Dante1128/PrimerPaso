import { beforeEach, describe, expect, it, vi } from "vitest";
import { Account, Address, Contract, Keypair, Networks, StrKey, TransactionBuilder, nativeToScVal, xdr } from "@stellar/stellar-sdk";

const estado = vi.hoisted(() => ({ filas: new Map<string, Record<string, unknown>>() }));
vi.mock("@/lib/stellar", () => ({ NETWORK_PASSPHRASE: "Test SDF Network ; September 2015" }));
vi.mock("@/lib/api", () => ({ ErrorApi: class extends Error {} }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: () => ({
  upsert: async (fila: Record<string, unknown>) => { if (!estado.filas.has(String(fila.tx_hash))) estado.filas.set(String(fila.tx_hash), fila); return { error: null }; },
  select: () => ({ eq: (_: string, hash: string) => ({ maybeSingle: async () => ({ data: estado.filas.get(hash) ?? null, error: null }) }) }),
}) }) }));
import { registrarPreparada, exigirPreparada } from "./transacciones";
import { firmanteDe, validarXdr } from "./soroban";

const fuente = Keypair.random();
const contrato = StrKey.encodeContract(Buffer.alloc(32, 1));
function crear(monto = 100, metodo = "deposit_collateral", id = contrato) {
  return new TransactionBuilder(new Account(fuente.publicKey(), "1"), { fee: "100", networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(id).call(metodo, nativeToScVal(monto, { type: "i128" }))).setTimeout(300).build();
}
beforeEach(() => estado.filas.clear());
describe("vinculación de transacciones", () => {
  it("identifica el firmante del servidor en credenciales Soroban actuales", () => {
    const credencial = new xdr.SorobanAddressCredentials({ address: new Address(fuente.publicKey()).toScAddress(), nonce: 1n, signatureExpirationLedger: 100, signature: xdr.ScVal.scvVoid() });
    for (const credentials of [xdr.SorobanCredentials.sorobanCredentialsAddress(credencial), xdr.SorobanCredentials.sorobanCredentialsAddressV2(credencial), xdr.SorobanCredentials.sorobanCredentialsAddressWithDelegates(new xdr.SorobanAddressCredentialsWithDelegates({ addressCredentials: credencial, delegates: [] }))]) {
      expect(firmanteDe({ credentials })).toBe(fuente.publicKey());
    }
    expect(firmanteDe({ credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount() })).toBeNull();
  });
  it("acepta firmas nuevas sobre la misma transacción preparada", async () => {
    const tx = crear();
    await registrarPreparada(tx.toXDR(), "usuario", "solicitud", "deposit_collateral");
    tx.sign(fuente);
    expect(await exigirPreparada(Buffer.from(tx.hash()).toString("hex"), "usuario", "solicitud", "deposit_collateral")).toBeTruthy();
    expect(validarXdr(tx.toXDR(), contrato, "deposit_collateral", fuente.publicKey()).hash()).toEqual(tx.hash());
  });
  it("rechaza cambiar monto, solicitud, usuario o método", async () => {
    const tx = crear();
    const hash = Buffer.from(tx.hash()).toString("hex");
    await registrarPreparada(tx.toXDR(), "u", "s", "deposit_collateral");
    for (const args of [[Buffer.from(crear(200).hash()).toString("hex"), "u", "s", "deposit_collateral"], [hash, "otro", "s", "deposit_collateral"], [hash, "u", "otra", "deposit_collateral"], [hash, "u", "s", "open_loan"]]) {
      await expect(exigirPreparada(args[0], args[1], args[2], args[3])).rejects.toThrow("no corresponde");
    }
  });
  it("comprueba contrato y método estructuralmente", () => {
    expect(() => validarXdr(crear(100, "repay").toXDR(), contrato, "deposit_collateral", fuente.publicKey())).toThrow();
    expect(() => validarXdr(crear().toXDR(), StrKey.encodeContract(Buffer.alloc(32, 2)), "deposit_collateral", fuente.publicKey())).toThrow();
    expect(() => validarXdr(crear().toXDR(), contrato, "deposit_collateral", Keypair.random().publicKey())).toThrow();
  });
  it("rechaza preparadas vencidas y permite recuperar confirmadas", async () => {
    const tx = crear(); const hash = Buffer.from(tx.hash()).toString("hex");
    await registrarPreparada(tx.toXDR(), "u", "s", "deposit_collateral");
    estado.filas.get(hash)!.expires_at = "2020-01-01";
    await expect(exigirPreparada(hash, "u", "s", "deposit_collateral")).rejects.toThrow("venció");
    estado.filas.get(hash)!.confirmed_at = "2026-01-01";
    expect(await exigirPreparada(hash, "u", "s", "deposit_collateral")).toBeTruthy();
  });
});
