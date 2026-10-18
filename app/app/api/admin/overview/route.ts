// Resumen para el admin: pool (en la cadena y en caché), ingresos y cartera.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirUsuario, manejar } from "@/lib/api";
import { LOAN_ID, aUsdc, poolDisponible } from "@/lib/soroban";
import { balanceUsdc } from "@/lib/stellar";

export const GET = manejar(async () => {
  await exigirUsuario(["admin"]);
  const db = supabaseAdmin();
  const treasury = process.env.TREASURY_ADDRESS ?? "";
  const [pool, saldo, balance, movimientos, ingresosMes, ingresos, prestamos] = await Promise.all([
    poolDisponible(),
    treasury ? balanceUsdc(treasury) : Promise.resolve(BigInt(0)),
    db.from("v_pool_balance").select("available_usd").maybeSingle(),
    db.from("pool_movements").select("id, type, amount, tx_hash, note, created_at").order("created_at", { ascending: false }).limit(20),
    db.from("v_platform_revenue").select("*").order("month", { ascending: false }),
    db.from("platform_revenue").select("type, amount_usd"),
    db.from("loans").select("status, principal, outstanding").eq("loan_contract_id", LOAN_ID),
  ]);

  const total = (tipo?: string) =>
    (ingresos.data ?? []).filter((r) => !tipo || r.type === tipo).reduce((s, r) => s + Number(r.amount_usd), 0);
  const cartera = prestamos.data ?? [];
  const activos = cartera.filter((l) => l.status === "active");

  return Response.json({
    pool: {
      treasury,
      saldoTreasury: aUsdc(saldo),
      disponibleParaPrestar: aUsdc(pool),
      capitalDisponibleCache: Number(balance.data?.available_usd ?? 0),
    },
    ingresos: {
      total: total(),
      interes: total("interest"),
      originacion: total("origination"),
      recargos: total("late_fee"),
      porMes: ingresosMes.data ?? [],
    },
    cartera: {
      activos: activos.length,
      pagados: cartera.filter((l) => l.status === "repaid").length,
      liquidados: cartera.filter((l) => l.status === "liquidated").length,
      capitalPrestado: cartera.reduce((s, l) => s + Number(l.principal), 0),
      saldoPorCobrar: activos.reduce((s, l) => s + Number(l.outstanding), 0),
    },
    movimientos: movimientos.data ?? [],
  });
});
