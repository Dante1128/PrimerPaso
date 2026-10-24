// Indexador: lee los eventos de los contratos loan e history desde Stellar
// RPC (getEvents), los guarda en onchain_events y los proyecta a las tablas
// caché (loans, installments, payments, collateral_events, credit_profiles,
// pool_movements, platform_revenue, platform_settings).
//
// La blockchain es la fuente de verdad: cada proyección de un préstamo vuelve
// a leer su estado con get_loan, así que reprocesar es seguro.
//
// Idempotencia (migración 0003_indexer_idempotente.sql):
//  - Un candado con vencimiento garantiza que corra un solo indexador a la vez.
//  - Índices únicos en onchain_events y en cada tabla proyectada: las
//    inserciones son "si no existe", así un evento nunca se cuenta dos veces.
//  - El evento se marca processed recién después de proyectarlo; si falla a
//    medias, queda pendiente y se reintenta en la siguiente corrida.
import "server-only";
import { randomUUID } from "crypto";
import { after } from "next/server";
import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { conReintentos, rpcServer } from "@/lib/stellar";
import { HISTORY_ID, LOAN_ID, aUsdc, leerCredencial, leerPrestamo, leerPuntaje, leerRegistro } from "@/lib/soroban";
import type { Database, Json } from "@/lib/database.types";

type Evento = {
  contrato: string;
  tipo: string;
  topics: unknown[];
  datos: Record<string, unknown>;
  ledger: number;
  txHash: string;
  indice: number;
  fecha: string;
};

const db = () => supabaseAdmin();
const usd = (v: unknown) => aUsdc(BigInt(v as bigint));
const iso = (segundos: bigint | number) => new Date(Number(segundos) * 1000).toISOString();

/** JSON seguro (los bigint pasan a string). */
function aJson(v: unknown): NonNullable<Json> {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)));
}

/** Segundos que dura el candado; se renueva en cada página de eventos. */
const CANDADO_SEGUNDOS = 120;

export type ResultadoSync = {
  eventos: number;
  hastaLedger: number;
  /** Eventos que quedaron pendientes por un error (se reintentan después). */
  pendientes: number;
  /** Otro indexador estaba corriendo: esta llamada no hizo nada. */
  ocupado?: boolean;
};

async function tomarCandado(dueno: string): Promise<boolean> {
  const { data, error } = await db().rpc("indexer_acquire_lock", { p_holder: dueno, p_seconds: CANDADO_SEGUNDOS });
  if (error) throw new Error(`Candado del indexador: ${error.message} (¿aplicaste la migración 0003?)`);
  return data === true;
}

/**
 * Sincroniza después de enviar la respuesta, para no hacer esperar al
 * usuario. Si falla o no alcanza, el cron o `/api/sync` lo retoman.
 */
export function sincronizarEnSegundoPlano(esperarMs = 15_000) {
  after(() => sincronizar({ esperarMs }).then(() => undefined, (e) => console.error("[indexer]", e)));
}

/**
 * Procesa los eventos nuevos de los dos contratos, y reintenta los que
 * quedaron pendientes. Si otro indexador está corriendo, espera hasta
 * `esperarMs` y, si sigue ocupado, no hace nada (ese otro procesará todo).
 */
export async function sincronizar({ esperarMs = 0 }: { esperarMs?: number } = {}): Promise<ResultadoSync> {
  const dueno = randomUUID();
  const limite = Date.now() + esperarMs;
  while (!(await tomarCandado(dueno))) {
    if (Date.now() >= limite) return { eventos: 0, hastaLedger: -1, pendientes: 0, ocupado: true };
    await new Promise((s) => setTimeout(s, 1000));
  }
  try {
    return await sincronizarConCandado(dueno);
  } finally {
    await db().rpc("indexer_release_lock", { p_holder: dueno });
  }
}

async function sincronizarConCandado(dueno: string): Promise<ResultadoSync> {
  const server = rpcServer();
  const contratos = [LOAN_ID, HISTORY_ID];

  let nuevos = await reprocesarPendientes(contratos);

  const { data: estados } = await db().from("indexer_state").select("contract_id, last_ledger").in("contract_id", contratos);
  const ultimo = Math.min(...contratos.map((c) => estados?.find((e) => e.contract_id === c)?.last_ledger ?? 0));
  const latest = (await conReintentos(() => server.getLatestLedger())).sequence;

  let inicio = Math.max(ultimo + 1, 1);
  if (inicio > latest) return { eventos: nuevos, hastaLedger: ultimo, pendientes: await contarPendientes(contratos) };

  let cursor: string | undefined;
  let hasta = ultimo;
  for (let pagina = 0; pagina < 50; pagina++) {
    await tomarCandado(dueno); // renueva el lease
    let resp: rpc.Api.GetEventsResponse;
    try {
      resp = await conReintentos(() => server.getEvents(
        cursor
          ? { cursor, filters: [{ type: "contract", contractIds: contratos }], limit: 200 }
          : { startLedger: inicio, filters: [{ type: "contract", contractIds: contratos }], limit: 200 },
      ));
    } catch (e) {
      // El RPC solo guarda unos días: si el inicio quedó fuera, arrancamos en el más antiguo.
      const m = String((e as Error).message).match(/ledger range:?\s*(\d+)\s*-\s*(\d+)/i);
      if (!cursor && m && Number(m[1]) > inicio) {
        inicio = Number(m[1]);
        pagina--;
        continue;
      }
      throw e;
    }

    for (const e of resp.events) {
      const ev = decodificar(e);
      const id = await guardarEvento(ev);
      if (id && (await proyectarYMarcar(id, ev))) nuevos++;
      hasta = Math.max(hasta, ev.ledger);
    }
    hasta = Math.max(hasta, resp.latestLedger - 1);
    if (resp.events.length < 200 || !resp.cursor) break;
    cursor = resp.cursor;
  }

  // Los eventos que fallaron quedan guardados como pendientes, así que avanzar
  // el ledger es seguro: no se pierden.
  const ahora = new Date().toISOString();
  const { error } = await db()
    .from("indexer_state")
    .upsert(contratos.map((c) => ({ contract_id: c, last_ledger: hasta, updated_at: ahora })), { onConflict: "contract_id" });
  if (error) throw new Error(`indexer_state: ${error.message}`);
  return { eventos: nuevos, hastaLedger: hasta, pendientes: await contarPendientes(contratos) };
}

/** Proyecta un evento ya guardado y lo marca como procesado. false si falló. */
async function proyectarYMarcar(id: string, ev: Evento): Promise<boolean> {
  try {
    await proyectar(ev);
  } catch (e) {
    console.error(`[indexer] ${ev.tipo} ${ev.txHash} quedó pendiente:`, (e as Error).message);
    return false;
  }
  const { error } = await db().from("onchain_events").update({ processed: true }).eq("id", id);
  if (error) throw new Error(`onchain_events: ${error.message}`);
  return true;
}

/** Reintenta los eventos guardados que no se llegaron a proyectar. */
async function reprocesarPendientes(contratos: string[]): Promise<number> {
  const { data, error } = await db()
    .from("onchain_events")
    .select("id, contract_id, event_type, ledger, tx_hash, event_index, payload")
    .in("contract_id", contratos)
    .eq("processed", false)
    .order("ledger")
    .order("event_index")
    .limit(200);
  if (error) throw new Error(`onchain_events: ${error.message}`);

  let ok = 0;
  for (const fila of data ?? []) {
    const p = (fila.payload ?? {}) as { topics?: unknown[]; datos?: Record<string, unknown>; fecha?: string };
    const ev: Evento = {
      contrato: fila.contract_id,
      tipo: fila.event_type,
      topics: p.topics ?? [],
      datos: p.datos ?? {},
      ledger: fila.ledger,
      txHash: fila.tx_hash,
      indice: fila.event_index,
      fecha: p.fecha ?? new Date().toISOString(),
    };
    if (await proyectarYMarcar(fila.id, ev)) ok++;
  }
  return ok;
}

async function contarPendientes(contratos: string[]): Promise<number> {
  const { count } = await db()
    .from("onchain_events")
    .select("id", { count: "exact", head: true })
    .in("contract_id", contratos)
    .eq("processed", false);
  return count ?? 0;
}

function decodificar(e: rpc.Api.EventResponse): Evento {
  const topics = e.topic.map((t) => scValToNative(t));
  const valor = scValToNative(e.value);
  return {
    contrato: String(e.contractId?.toString() ?? ""),
    tipo: String(topics[0]),
    topics: topics.slice(1),
    datos: valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : { valor },
    ledger: e.ledger,
    txHash: e.txHash,
    indice: Number(e.id.split("-").pop() ?? 0),
    fecha: e.ledgerClosedAt,
  };
}

/**
 * Guarda el evento crudo como pendiente. Devuelve su id si es nuevo, o null
 * si ya estaba (el índice único descarta el duplicado de forma atómica).
 */
async function guardarEvento(ev: Evento): Promise<string | null> {
  const { data, error } = await db()
    .from("onchain_events")
    .upsert(
      {
        contract_id: ev.contrato,
        event_type: ev.tipo,
        ledger: ev.ledger,
        tx_hash: ev.txHash,
        event_index: ev.indice,
        payload: aJson({ topics: ev.topics, datos: ev.datos, fecha: ev.fecha }),
        processed: false,
      },
      { onConflict: "contract_id,tx_hash,event_index", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`onchain_events: ${error.message} (¿aplicaste la migración 0003?)`);
  return data?.[0]?.id ?? null;
}

type Tabla = keyof Database["public"]["Tables"];

/**
 * Inserta filas ignorando las que ya existen según el índice único
 * `conflicto`. Cualquier otro error se lanza (y el evento queda pendiente).
 */
async function insertarUnico<T extends Tabla>(
  tabla: T,
  filas: Database["public"]["Tables"][T]["Insert"] | Database["public"]["Tables"][T]["Insert"][],
  conflicto: string,
) {
  const { error } = await db()
    .from(tabla)
    .upsert(filas as never, { onConflict: conflicto, ignoreDuplicates: true });
  if (error) throw new Error(`${tabla}: ${error.message}`);
}

/** update que falla en voz alta en vez de ignorar el error. */
function exigir(r: { error: { message: string } | null }, que: string) {
  if (r.error) throw new Error(`${que}: ${r.error.message}`);
}

// ---------------------------------------------------------------------------
// Proyecciones
// ---------------------------------------------------------------------------

async function proyectar(ev: Evento) {
  const d = ev.datos;
  if (ev.contrato === HISTORY_ID) {
    // Pagos, defaults y credenciales: se refresca el perfil crediticio.
    await refrescarPerfilCrediticio(String(ev.topics[0]));
    return;
  }

  switch (ev.tipo) {
    case "collateral_deposited":
      await insertarUnico(
        "collateral_events",
        {
          type: "deposit",
          position_onchain_id: Number(ev.topics[0]),
          amount: usd(d.amount),
          to_address: String(d.depositor),
          tx_hash: ev.txHash,
          ledger: ev.ledger,
          created_at: ev.fecha,
        },
        "tx_hash,type",
      );
      break;

    case "loan_opened": {
      const loanUuid = await refrescarPrestamo(BigInt(ev.topics[0] as bigint), ev);
      if (!loanUuid) break;
      exigir(
        await db()
          .from("collateral_events")
          .update({ loan_id: loanUuid })
          .eq("position_onchain_id", Number(d.position_id))
          .is("loan_id", null),
        "collateral_events",
      );
      await insertarUnico(
        "pool_movements",
        {
          type: "disburse",
          amount: usd(d.disbursed),
          loan_id: loanUuid,
          tx_hash: ev.txHash,
          ledger: ev.ledger,
          note: `Desembolso del préstamo #${ev.topics[0]}`,
          created_at: ev.fecha,
        },
        "tx_hash,type",
      );
      await insertarUnico(
        "platform_revenue",
        { type: "origination", amount_usd: usd(d.origination_fee), loan_id: loanUuid, tx_hash: ev.txHash, created_at: ev.fecha },
        "tx_hash,type",
      );
      break;
    }

    case "payment_recorded": {
      const loanUuid = await refrescarPrestamo(BigInt(ev.topics[0] as bigint), ev);
      if (!loanUuid) break;
      await insertarUnico(
        "payments",
        {
          loan_id: loanUuid,
          principal: usd(d.principal),
          interest: usd(d.interest),
          on_time: Boolean(d.on_time),
          tx_hash: ev.txHash,
          ledger: ev.ledger,
          created_at: ev.fecha,
        },
        "tx_hash",
      );
      const { data: pago } = await db().from("payments").select("id").eq("tx_hash", ev.txHash).maybeSingle();
      if (BigInt(d.principal as bigint) > BigInt(0)) {
        await insertarUnico(
          "pool_movements",
          { type: "repay_principal", amount: usd(d.principal), loan_id: loanUuid, tx_hash: ev.txHash, ledger: ev.ledger, created_at: ev.fecha },
          "tx_hash,type",
        );
      }
      if (BigInt(d.interest as bigint) > BigInt(0)) {
        await insertarUnico(
          "platform_revenue",
          {
            type: "interest",
            amount_usd: usd(d.interest),
            loan_id: loanUuid,
            payment_id: pago?.id ?? null,
            tx_hash: ev.txHash,
            created_at: ev.fecha,
          },
          "tx_hash,type",
        );
      }
      await marcarCuotas(loanUuid, ev, Boolean(d.on_time), pago?.id ?? null);
      break;
    }

    case "collateral_released": {
      const loanUuid = await refrescarPrestamo(BigInt(ev.topics[0] as bigint), ev);
      await insertarUnico(
        "collateral_events",
        {
          loan_id: loanUuid,
          type: "release",
          amount: usd(d.amount),
          to_address: String(ev.topics[1]),
          tx_hash: ev.txHash,
          ledger: ev.ledger,
          created_at: ev.fecha,
        },
        "tx_hash,type",
      );
      break;
    }

    case "loan_repaid":
      await refrescarPrestamo(BigInt(ev.topics[0] as bigint), ev);
      break;

    case "loan_liquidated": {
      const loanUuid = await refrescarPrestamo(BigInt(ev.topics[0] as bigint), ev);
      // Reparto de lo tomado: capital, luego interés, luego recargo.
      let resto = BigInt(d.taken as bigint);
      const capital = minimo(resto, BigInt(d.principal_due as bigint));
      resto -= capital;
      const interes = minimo(resto, BigInt(d.interest_due as bigint));
      resto -= interes;
      const recargo = minimo(resto, BigInt(d.late_fee as bigint));
      await insertarUnico(
        "collateral_events",
        {
          loan_id: loanUuid,
          type: "liquidation",
          amount: usd(d.taken),
          to_address: process.env.TREASURY_ADDRESS ?? null,
          tx_hash: ev.txHash,
          ledger: ev.ledger,
          created_at: ev.fecha,
        },
        "tx_hash,type",
      );
      if (capital > BigInt(0)) {
        await insertarUnico(
          "pool_movements",
          {
            type: "repay_principal",
            amount: aUsdc(capital),
            loan_id: loanUuid,
            tx_hash: ev.txHash,
            ledger: ev.ledger,
            note: "Recuperado por liquidación",
            created_at: ev.fecha,
          },
          "tx_hash,type",
        );
      }
      const ingresos = [
        { type: "interest" as const, monto: interes },
        { type: "late_fee" as const, monto: recargo },
      ].filter((x) => x.monto > BigInt(0));
      if (ingresos.length) {
        await insertarUnico(
          "platform_revenue",
          ingresos.map((x) => ({ type: x.type, amount_usd: aUsdc(x.monto), loan_id: loanUuid, tx_hash: ev.txHash, created_at: ev.fecha })),
          "tx_hash,type",
        );
      }
      break;
    }

    case "collateral_returned": {
      const posicion = Number(ev.topics[0]);
      const { data: dep } = await db()
        .from("collateral_events")
        .select("loan_id")
        .eq("position_onchain_id", posicion)
        .eq("type", "deposit")
        .maybeSingle();
      await insertarUnico(
        "collateral_events",
        {
          loan_id: dep?.loan_id ?? null,
          position_onchain_id: posicion,
          type: dep?.loan_id ? "return" : "withdraw",
          amount: usd(d.amount),
          to_address: String(ev.topics[1]),
          tx_hash: ev.txHash,
          ledger: ev.ledger,
          created_at: ev.fecha,
        },
        "tx_hash,type",
      );
      break;
    }

    case "params_updated": {
      const p = d.params as Record<string, bigint | number | string>;
      const r = await db()
        .from("platform_settings")
        .update({
          max_ltv_bps: Number(p.max_ltv_bps),
          rate_bps: Number(p.rate_bps),
          origination_fee_bps: Number(p.origination_fee_bps),
          late_fee_bps: Number(p.late_fee_bps),
          yield_share_platform_bps: Number(p.yield_share_platform_bps),
          grace_seconds: Number(p.grace_seconds),
          min_amount_usd: aUsdc(BigInt(p.min_principal)),
          max_amount_usd: aUsdc(BigInt(p.max_principal)),
          max_installments: Number(p.max_installments),
          updated_at: ev.fecha,
        })
        .eq("id", true);
      exigir(r, "platform_settings");
      break;
    }
  }
}

const minimo = (a: bigint, b: bigint) => (a < b ? a : b);

/** Perfil (profiles.id) dueño de una wallet, si existe. */
async function perfilDeWallet(address: string): Promise<string | null> {
  const { data } = await db().from("wallets").select("profile_id").eq("address", address).limit(1).maybeSingle();
  return data?.profile_id ?? null;
}

/**
 * Lee el préstamo desde la cadena y lo guarda en `loans` (crea la fila y
 * su calendario de cuotas la primera vez). Devuelve el uuid de la fila.
 */
async function refrescarPrestamo(onchainId: bigint, ev: Evento): Promise<string | null> {
  const l = await leerPrestamo(onchainId);
  if (!l) return null;

  const estado = l.status === "Repaid" ? "repaid" : l.status === "Liquidated" ? "liquidated" : "active";
  const bloqueada = estado === "active" ? l.collateral_initial - l.collateral_released : BigInt(0);
  const fila = {
    onchain_loan_id: Number(l.id),
    onchain_position_id: Number(l.position_id),
    loan_contract_id: LOAN_ID,
    borrower_address: l.borrower,
    depositor_address: l.depositor,
    asset_contract_id: process.env.NEXT_PUBLIC_USDC_CONTRACT_ID ?? "",
    principal: aUsdc(l.principal),
    origination_fee: aUsdc(l.origination_fee),
    collateral_initial: aUsdc(l.collateral_initial),
    collateral_locked: aUsdc(bloqueada),
    collateral_released: aUsdc(estado === "active" ? l.collateral_released : l.collateral_initial - bloqueada),
    principal_paid: aUsdc(l.principal_paid),
    interest_paid: aUsdc(l.interest_paid),
    outstanding: aUsdc(l.principal - l.principal_paid),
    rate_bps: l.terms.rate_bps,
    installments: l.installments,
    status: estado as "active" | "repaid" | "liquidated",
    opened_at: iso(l.opened_at),
    closed_at: estado === "active" ? null : ev.fecha,
    updated_at: new Date().toISOString(),
  };

  const { data: existente } = await db()
    .from("loans")
    .select("id")
    .eq("loan_contract_id", LOAN_ID)
    .eq("onchain_loan_id", Number(l.id))
    .maybeSingle();
  if (existente) {
    exigir(await db().from("loans").update(fila).eq("id", existente.id), "loans");
    return existente.id;
  }

  // Primera vez: vincula estudiante y solicitud aprobada, y crea las cuotas.
  const studentId = await perfilDeWallet(l.borrower);
  const { data: solicitud } = studentId
    ? await db()
        .from("loan_applications")
        .select("id")
        .eq("student_id", studentId)
        .eq("status", "approved")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: nuevo, error } = await db()
    .from("loans")
    .insert({ ...fila, student_id: studentId, application_id: solicitud?.id ?? null, opened_tx_hash: ev.txHash })
    .select("id")
    .single();
  if (error || !nuevo) throw new Error(`No se pudo guardar el préstamo: ${error?.message}`);

  if (solicitud) {
    exigir(
      await db().from("loan_applications").update({ status: "opened", updated_at: new Date().toISOString() }).eq("id", solicitud.id),
      "loan_applications",
    );
  }

  // Calendario estimado: capital fijo por cuota; interés sobre el saldo previsto.
  const n = l.installments;
  const porCuota = l.principal / BigInt(n);
  const cuotas = [];
  let saldo = l.principal;
  for (let k = 1; k <= n; k++) {
    const capital = k === n ? saldo : porCuota;
    const interes = (saldo * BigInt(l.terms.rate_bps)) / BigInt(10_000) / BigInt(12);
    cuotas.push({
      loan_id: nuevo.id,
      number: k,
      due_at: iso(l.first_due_ts + BigInt(k - 1) * l.period_seconds),
      principal_due: aUsdc(capital),
      interest_due: aUsdc(interes),
    });
    saldo -= capital;
  }
  await insertarUnico("installments", cuotas, "loan_id,number");
  return nuevo.id;
}

/** Marca como pagadas las cuotas que la cadena da por completadas. */
async function marcarCuotas(loanUuid: string, ev: Evento, aTiempo: boolean, pagoId: string | null) {
  const { data: loan } = await db().from("loans").select("onchain_loan_id").eq("id", loanUuid).single();
  const l = loan ? await leerPrestamo(loan.onchain_loan_id) : null;
  if (!l) return;
  const { data: pendientes } = await db()
    .from("installments")
    .select("id, number")
    .eq("loan_id", loanUuid)
    .is("paid_at", null)
    .lte("number", l.installments_paid);
  for (const c of pendientes ?? []) {
    await db().from("installments").update({ paid_at: ev.fecha, status: aTiempo ? "paid" : "late" }).eq("id", c.id);
    if (pagoId) await db().from("payments").update({ installment_id: c.id }).eq("id", pagoId).is("installment_id", null);
  }
}

/** Puntaje, contadores y credencial del prestatario, leídos de history. */
async function refrescarPerfilCrediticio(borrower: string) {
  const profileId = await perfilDeWallet(borrower);
  if (!profileId) return;
  const [puntaje, registro, credencial] = await Promise.all([
    leerPuntaje(borrower),
    leerRegistro(borrower),
    leerCredencial(borrower),
  ]);
  await db()
    .from("credit_profiles")
    .upsert(
      {
        profile_id: profileId,
        borrower_address: borrower,
        score: puntaje,
        on_time_payments: registro.on_time,
        late_payments: registro.late,
        defaults: registro.defaults,
        credential_id: credencial ? `${HISTORY_ID}:${borrower}` : null,
        credential_issued_at: credencial ? iso(credencial.issued_at) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" },
    )
    .then((r) => exigir(r, "credit_profiles"));
}
