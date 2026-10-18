// SEP-10: verifica el challenge firmado y vincula la wallet al usuario.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, errorJson } from "@/lib/auth";
import { verifyChallenge } from "@/lib/sep10";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return errorJson("No autenticado", 401);

  const body = await req.json().catch(() => ({}));
  const signedXdr: string | undefined = body?.signedXdr;
  if (!signedXdr) return errorJson("Falta la transacción firmada", 400);

  let address: string;
  try {
    address = verifyChallenge(signedXdr);
  } catch {
    return errorJson("La firma del challenge no es válida", 400);
  }

  const db = supabaseAdmin();
  const { data: existente } = await db
    .from("wallets")
    .select("id, profile_id")
    .eq("address", address)
    .maybeSingle();
  if (existente && existente.profile_id !== user.id) {
    return errorJson("Esa wallet ya está vinculada a otra cuenta", 409);
  }

  const ahora = new Date().toISOString();
  if (existente) {
    await db.from("wallets").update({ sep10_verified_at: ahora }).eq("id", existente.id);
  } else {
    // La nueva wallet pasa a ser la principal.
    await db.from("wallets").update({ is_primary: false }).eq("profile_id", user.id);
    const { error } = await db
      .from("wallets")
      .insert({ profile_id: user.id, address, sep10_verified_at: ahora, is_primary: true });
    if (error) return errorJson(error.message, 500);
  }
  return Response.json({ ok: true, address });
}
