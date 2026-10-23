// Cron del indexador. Protegido con CRON_SECRET:
//   Authorization: Bearer <CRON_SECRET>
// (Vercel Cron envía ese header automáticamente si CRON_SECRET está definido.)
import { timingSafeEqual } from "crypto";
import { sincronizar } from "@/lib/indexer";
import { renovarPrestamos } from "@/lib/renovacion";

function autorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secreto || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secreto);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function correr(req: Request) {
  if (!autorizado(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  try {
    const r = await sincronizar();
    const vida = await renovarPrestamos();
    return Response.json({ ok: true, ...r, vida });
  } catch (e) {
    console.error("[cron/indexer]", e);
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const GET = correr;
export const POST = correr;
