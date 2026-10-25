// Verifica el código de 6 dígitos enviado por email y abre la sesión.
// También sirve para reenviar el código ({ email, resend: true }).
import { supabaseServidor } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { errorJson } from "@/lib/auth";
import { limitarAuth } from "@/lib/limite";
import { auditarIngresoStaff } from "@/lib/api";
import { ipDe } from "@/lib/peticion";
import { pedirCodigoSchema, verificarCodigoSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  // Frena también el adivinar códigos de 6 dígitos.
  const limite = await limitarAuth(req, "verify-email", body?.email);
  if (limite) return limite;
  const supabase = await supabaseServidor();

  if (body?.resend) {
    const p = pedirCodigoSchema.safeParse(body);
    if (!p.success) return errorJson("Email inválido", 400);
    const { error } = await supabase.auth.resend({ type: "signup", email: p.data.email });
    if (error) return errorJson(error.message, 400);
    return Response.json({ ok: true });
  }

  const parsed = verificarCodigoSchema.safeParse(body);
  if (!parsed.success) return errorJson("El código debe tener 6 dígitos", 400);

  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });
  if (error || !data.user) return errorJson("Código inválido o expirado", 400);

  // Asegura el perfil (si no lo creó un trigger de la base).
  const fullName = (data.user.user_metadata?.full_name as string | undefined) ?? null;
  const db = supabaseAdmin();
  const { data: perfil } = await db.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
  if (!perfil) {
    await db.from("profiles").insert({ id: data.user.id, full_name: fullName });
  } else if (fullName) {
    await db.from("profiles").update({ full_name: fullName }).eq("id", data.user.id).is("full_name", null);
  }
  await auditarIngresoStaff(data.user.id, "codigo", ipDe(req));
  return Response.json({ ok: true });
}
