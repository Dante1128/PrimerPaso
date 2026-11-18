// SEP-10: verifica el challenge firmado.
//  - Con sesión activa: vincula la wallet a la cuenta (flujo clásico).
//  - Sin sesión: es el login/registro vía Pollar (login social con wallet
//    embebida) — la wallet YA viene verificada por SEP-10, así que abre
//    sesión (o crea la cuenta la primera vez) usándola como identidad.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, abrirSesionPorWallet, errorJson } from "@/lib/auth";
import { verifyChallenge } from "@/lib/cadena/sep10";

export async function POST(req: Request) {
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

  const sesion = await getSessionUser();
  let profileId: string;
  if (sesion) {
    if (existente && existente.profile_id !== sesion.id) {
      return errorJson("Esa wallet ya está vinculada a otra cuenta", 409);
    }
    profileId = sesion.id;
  } else {
    const fullName: string | undefined = typeof body?.fullName === "string" ? body.fullName : undefined;
    profileId = await abrirSesionPorWallet(address, fullName);
    if (existente && existente.profile_id !== profileId) {
      return errorJson("Esa wallet ya está vinculada a otra cuenta", 409);
    }
  }

  const ahora = new Date().toISOString();
  if (existente) {
    await db.from("wallets").update({ sep10_verified_at: ahora }).eq("id", existente.id);
  } else {
    // La nueva wallet pasa a ser la principal.
    await db.from("wallets").update({ is_primary: false }).eq("profile_id", profileId);
    const { error } = await db
      .from("wallets")
      .insert({ profile_id: profileId, address, sep10_verified_at: ahora, is_primary: true });
    if (error) return errorJson(error.message, 500);
  }
  return Response.json({ ok: true, address });
}
