import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret) return Response.json({ error: "No autorizado" }, { status: 401 });
  const actual = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { error } = await supabaseAdmin()
      .from("indexer_state")
      .select("contract_id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(10_000));
    if (error) throw error;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[cron/supabase] Falló la consulta de disponibilidad");
    return Response.json({ ok: false }, { status: 503 });
  }
}
