// Parámetros del negocio.
//  GET → platform_settings (público: lo usa el simulador) + get_params y pool en vivo.
//  PUT → solo admin: actualiza el contrato con set_params y luego la tabla.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { exigirUsuario, manejar, ErrorApi, auditar, linkTx } from "@/lib/api";
import { parametrosSchema } from "@/lib/validation";
import { LOAN_ID, aStroops, aUsdc, adminKeypair, ejecutarComoServidor, leerParams, poolDisponible } from "@/lib/soroban";
import { sincronizar } from "@/lib/indexer";
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";

export const GET = manejar(async () => {
  const user = await getSessionUser();
  const { data } = await supabaseAdmin().from("platform_settings").select("*").eq("id", true).single();
  if (!user?.esStaff) return Response.json({ settings: data });

  const [p, pool] = await Promise.all([leerParams(), poolDisponible()]);
  const cadena = {
    max_ltv_bps: p.max_ltv_bps,
    rate_bps: p.rate_bps,
    origination_fee_bps: p.origination_fee_bps,
    late_fee_bps: p.late_fee_bps,
    yield_share_platform_bps: p.yield_share_platform_bps,
    grace_seconds: Number(p.grace_seconds),
    min_amount_usd: aUsdc(p.min_principal),
    max_amount_usd: aUsdc(p.max_principal),
    max_installments: p.max_installments,
  };
  const sincronizado =
    !!data && (Object.keys(cadena) as (keyof typeof cadena)[]).every((k) => Number(data[k]) === Number(cadena[k]));
  return Response.json({ settings: data, cadena, sincronizado, poolDisponible: aUsdc(pool) });
});

export const PUT = manejar(async (req: Request) => {
  const user = await exigirUsuario(["admin"]);
  const parsed = parametrosSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ErrorApi(parsed.error.issues[0]?.message ?? "Parámetros inválidos");
  const p = parsed.data;
  if (p.min_amount_usd > p.max_amount_usd) throw new ErrorApi("El mínimo no puede superar al máximo");

  // LoanParams del contrato: un map con claves ordenadas.
  const u32 = (v: number) => nativeToScVal(v, { type: "u32" });
  const campo = (k: string, v: xdr.ScVal) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: v });
  const params = xdr.ScVal.scvMap(
    [
      campo("grace_seconds", nativeToScVal(BigInt(p.grace_seconds), { type: "u64" })),
      campo("late_fee_bps", u32(p.late_fee_bps)),
      campo("max_installments", u32(p.max_installments)),
      campo("max_ltv_bps", u32(p.max_ltv_bps)),
      campo("max_principal", nativeToScVal(aStroops(p.max_amount_usd), { type: "i128" })),
      campo("min_principal", nativeToScVal(aStroops(p.min_amount_usd), { type: "i128" })),
      campo("origination_fee_bps", u32(p.origination_fee_bps)),
      campo("rate_bps", u32(p.rate_bps)),
      campo("yield_share_platform_bps", u32(p.yield_share_platform_bps)),
    ],
  );

  const r = await ejecutarComoServidor(adminKeypair(), LOAN_ID, "set_params", [params]);
  if (!r.ok) throw new ErrorApi(`No se pudo actualizar el contrato (${r.detail ?? "sin detalle"})`, 502);

  // El evento params_updated lo proyecta el indexador; por si acaso, también aquí.
  await supabaseAdmin()
    .from("platform_settings")
    .update({ ...p, updated_at: new Date().toISOString() })
    .eq("id", true);
  await sincronizar().catch((e) => console.error("[indexer]", e));
  await auditar(user.id, "settings_updated", "platform_settings", "true", { ...p, tx_hash: r.hash });
  return Response.json({ ok: true, hash: r.hash, link: linkTx(r.hash) });
});
