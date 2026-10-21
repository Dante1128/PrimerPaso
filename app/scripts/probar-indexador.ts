// Prueba de idempotencia del indexador contra la base real:
//  1. Lanza 4 sincronizaciones en paralelo: solo una debe trabajar.
//  2. Marca como pendientes eventos ya proyectados y reprocesa: no debe
//     duplicar pagos, ingresos, movimientos del pool ni de garantía.
// Uso: npm run indexar:probar   (requiere la migración 0003 aplicada)
import { sincronizar } from "../lib/indexer";
import { supabaseAdmin } from "../lib/supabase/admin";

const db = supabaseAdmin();
const TABLAS = ["onchain_events", "payments", "platform_revenue", "pool_movements", "collateral_events", "installments", "loans"] as const;

async function conteos() {
  const r: Record<string, number> = {};
  for (const t of TABLAS) {
    const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
    if (error) throw new Error(`${t}: ${error.message}`);
    r[t] = count ?? 0;
  }
  return r;
}

async function main() {
  let ok = true;
  const antes = await conteos();

  // 1. Concurrencia
  const resultados = await Promise.all([1, 2, 3, 4].map(() => sincronizar()));
  const trabajaron = resultados.filter((r) => !r.ocupado).length;
  console.log(`Sincronizaciones en paralelo: ${trabajaron} trabajó, ${4 - trabajaron} esperaron afuera`);
  if (trabajaron !== 1) ok = false;

  // 2. Reproceso de eventos ya proyectados (simula una caída a medias)
  const { data: eventos } = await db
    .from("onchain_events")
    .select("id")
    .eq("processed", true)
    .in("event_type", ["payment_recorded", "loan_opened", "collateral_released", "loan_liquidated"])
    .limit(10);
  const ids = (eventos ?? []).map((e) => e.id);
  await db.from("onchain_events").update({ processed: false }).in("id", ids);
  const re = await sincronizar({ esperarMs: 30_000 });
  console.log(`Reprocesados ${ids.length} eventos ya proyectados · pendientes al final: ${re.pendientes}`);
  if (re.pendientes !== 0) ok = false;

  const despues = await conteos();
  for (const t of TABLAS) {
    const nuevos = despues[t] - antes[t];
    const marca = t === "onchain_events" || nuevos === 0 ? "✓" : "?";
    console.log(`  ${marca} ${t}: ${antes[t]} → ${despues[t]}`);
  }

  // Ninguna proyección puede crecer por el reproceso (solo eventos realmente nuevos).
  const crecieron = TABLAS.filter((t) => t !== "onchain_events" && despues[t] !== antes[t]);
  if (crecieron.length && resultados.every((r) => r.ocupado || r.eventos === 0) && re.eventos === ids.length) {
    console.log(`  Ojo: crecieron ${crecieron.join(", ")} sin eventos nuevos en la cadena`);
    ok = false;
  }

  console.log(ok ? "\nOK: el indexador es idempotente" : "\nFALLÓ: revisar arriba");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
