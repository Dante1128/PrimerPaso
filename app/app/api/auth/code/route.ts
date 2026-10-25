// Ingreso sin contraseña: envía un código de 6 dígitos al email.
// Se verifica con POST /api/auth/verify-email.
import { supabaseServidor } from "@/lib/supabase/server";
import { errorJson } from "@/lib/auth";
import { pedirCodigoSchema } from "@/lib/validation";
import { verificarCaptcha } from "@/lib/turnstile";
import { ipDe } from "@/lib/peticion";
import { limitarAuth } from "@/lib/limite";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const limite = await limitarAuth(req, "code", body?.email);
  if (limite) return limite;
  const parsed = pedirCodigoSchema.safeParse(body);
  if (!parsed.success) return errorJson("Email inválido", 400);
  const captcha = await verificarCaptcha(body?.captchaToken, ipDe(req));
  if (captcha) return errorJson(captcha, 400);

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
