// Ingreso sin contraseña: envía un código de 6 dígitos al email.
// Se verifica con POST /api/auth/verify-email.
import { supabaseServidor } from "@/lib/supabase/server";
import { errorJson } from "@/lib/auth";
import { pedirCodigoSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const parsed = pedirCodigoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson("Email inválido", 400);

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    if (/rate limit/i.test(error.message)) {
      return errorJson("Se enviaron demasiados emails. Espera unos minutos.", 429);
    }
    return errorJson("No encontramos una cuenta con ese email.", 404);
  }
  return Response.json({ ok: true });
}
