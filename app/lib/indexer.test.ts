import { beforeEach, describe, expect, it, vi } from "vitest";
import { nativeToScVal } from "@stellar/stellar-sdk";

type Fila = Record<string, unknown>;
const estado = vi.hoisted(() => ({
  tablas: {} as Record<string, Fila[]>, eventos: [] as unknown[], fallarCuotas: false, fallarEstado: false, candado: true,
  solicitudesRpc: [] as Record<string, unknown>[],
}));

/** Doble de PostgREST con fallos entre escrituras, sin acceso a la base real. */
class Consulta implements PromiseLike<{ data: Fila[]; error: { message: string } | null; count?: number }> {
  filtros: ((f: Fila) => boolean)[] = [];
  accion = "select"; valores: Fila[] = []; conflicto = ""; ignorar = false; inicio = 0; fin = Infinity; limite = Infinity;
  constructor(readonly tabla: string) {}
  select() { return this; }
  eq(k: string, v: unknown) { this.filtros.push((f) => f[k] === v); return this; }
  in(k: string, v: unknown[]) { this.filtros.push((f) => v.includes(f[k])); return this; }
  is(k: string, v: unknown) { this.filtros.push((f) => (f[k] ?? null) === v); return this; }
  contains(k: string, v: { topics: string[] }) { this.filtros.push((f) => v.topics.every((t) => ((f[k] as { topics: string[] }).topics).includes(t))); return this; }
  order() { return this; }
  range(a: number, b: number) { this.inicio = a; this.fin = b; return this; }
  limit(n: number) { this.limite = n; return this; }
  insert(v: Fila | Fila[]) { this.accion = "insert"; this.valores = Array.isArray(v) ? v : [v]; return this; }
  update(v: Fila) { this.accion = "update"; this.valores = [v]; return this; }
  upsert(v: Fila | Fila[], opts: { onConflict: string; ignoreDuplicates?: boolean }) {
    this.accion = "upsert"; this.valores = Array.isArray(v) ? v : [v]; this.conflicto = opts.onConflict; this.ignorar = !!opts.ignoreDuplicates; return this;
  }
  ejecutar() {
    if (this.tabla === "installments" && this.accion === "upsert" && estado.fallarCuotas) {
      estado.fallarCuotas = false;
      return { data: [], error: { message: "interrupción al crear cuotas" } };
    }
    if (this.tabla === "indexer_state" && estado.fallarEstado) return { data: [], error: { message: "base no disponible" } };
    const tabla = estado.tablas[this.tabla] ??= [];
    let filas = tabla.filter((f) => this.filtros.every((p) => p(f)));
    if (this.accion === "update") filas.forEach((f) => Object.assign(f, this.valores[0]));
    if (this.accion === "insert" || this.accion === "upsert") {
      filas = [];
      for (const v of this.valores) {
        const existente = this.accion === "upsert" ? tabla.find((f) => this.conflicto.split(",").every((k) => f[k] === v[k])) : null;
        if (existente) { if (!this.ignorar) { Object.assign(existente, v); filas.push(existente); } }
        else { const fila = { id: `${this.tabla}-${tabla.length}`, ...v }; tabla.push(fila); filas.push(fila); }
      }
    }
    filas = filas.slice(this.inicio, Math.min(this.fin + 1, this.inicio + this.limite));
    return { data: filas, error: null, count: filas.length };
  }
  async maybeSingle() { const r = this.ejecutar(); return { ...r, data: r.data[0] ?? null }; }
  single() { return this.maybeSingle(); }
  then<A = { data: Fila[]; error: { message: string } | null; count?: number }, B = never>(ok?: ((v: { data: Fila[]; error: { message: string } | null; count?: number }) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve(this.ejecutar()).then(ok, fail);
  }
}
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: (tabla: string) => new Consulta(tabla), rpc: async () => ({ data: estado.candado, error: null }) }) }));
vi.mock("@/lib/stellar", () => ({ conReintentos: (fn: () => unknown) => fn(), rpcServer: () => ({
  getLatestLedger: async () => ({ sequence: 100 }),
  getEvents: async (req: Record<string, unknown>) => { estado.solicitudesRpc.push(req); return { events: estado.eventos, latestLedger: 100, cursor: "fin" }; },
}) }));
vi.mock("@/lib/soroban", () => ({
  LOAN_ID: "loan", HISTORY_ID: "history", aUsdc: (v: bigint) => Number(v) / 1e7,
  leerPrestamo: async () => ({
    id: 1n, position_id: 1n, borrower: "wallet", depositor: "wallet", principal: 1000000000n, origination_fee: 10000000n,
    collateral_initial: 1250000000n, collateral_released: 0n, principal_paid: 0n, interest_paid: 0n,
    installments: 2, installments_paid: 0, first_due_ts: 2000000000n, period_seconds: 2592000n, opened_at: 1900000000n,
    terms: { rate_bps: 800 }, status: "Active",
  }),
}));
import { sincronizar } from "./indexer";

function evento(tipo = "loan_opened") {
  return { id: "0000000000000000010-0000000000", contractId: { toString: () => "loan" }, type: "contract", ledger: 10,
    ledgerClosedAt: "2026-01-01T00:00:00Z", transactionIndex: 1, inSuccessfulContractCall: true, txHash: "tx-open",
    topic: [nativeToScVal(tipo, { type: "symbol" }), nativeToScVal(1n, { type: "u64" })],
    value: nativeToScVal({ position_id: 1n, disbursed: 990000000n, origination_fee: 10000000n }),
  };
}
beforeEach(() => {
  estado.tablas = { wallets: [{ address: "wallet", profile_id: "student" }],
    loan_applications: [{ id: "application", status: "approved" }],
    prepared_transactions: [{ tx_hash: "tx-open", entity_id: "application", method: "open_loan" }],
  };
  estado.eventos = [evento()]; estado.fallarCuotas = false; estado.fallarEstado = false; estado.candado = true; estado.solicitudesRpc = [];
});
describe("indexador con RPC y base simulados", () => {
  it("completa escrituras interrumpidas sin duplicar el préstamo ni ingresos", async () => {
    estado.fallarCuotas = true;
    expect((await sincronizar()).pendientes).toBe(1);
    expect(estado.tablas.loans).toHaveLength(1);
    expect((await sincronizar()).pendientes).toBe(0);
    expect(estado.tablas.loans).toHaveLength(1);
    expect(estado.tablas.installments).toHaveLength(2);
    expect(estado.tablas.loan_applications[0].status).toBe("opened");
    expect(estado.tablas.platform_revenue).toHaveLength(1);
    await sincronizar();
    expect(estado.tablas.platform_revenue).toHaveLength(1);
  });
  it("retoma un cursor persistido en vez de empezar en un ledger posterior", async () => {
    estado.tablas.indexer_state = [{ contract_id: "loan", last_ledger: 9, last_cursor: "pagina-50" }, { contract_id: "history", last_ledger: 9, last_cursor: "pagina-50" }];
    await sincronizar();
    expect(estado.solicitudesRpc[0].cursor).toBe("pagina-50");
    expect(estado.solicitudesRpc[0].startLedger).toBeUndefined();
  });
  it("no trabaja cuando otro proceso tiene el candado", async () => {
    estado.candado = false;
    expect((await sincronizar()).ocupado).toBe(true);
    expect(estado.solicitudesRpc).toHaveLength(0);
  });
  it("no avanza el checkpoint cuando falla su lectura", async () => {
    estado.fallarEstado = true;
    await expect(sincronizar()).rejects.toThrow("base no disponible");
    expect(estado.solicitudesRpc).toHaveLength(0);
  });
  it("no asigna a una solicitud distinta un préstamo sin transacción preparada", async () => {
    estado.tablas.prepared_transactions = [];
    await sincronizar();
    expect(estado.tablas.loans[0].application_id).toBeNull();
    expect(estado.tablas.loan_applications[0].status).toBe("approved");
  });
});
