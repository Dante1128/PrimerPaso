// Ingreso con email y contraseña.
import { supabaseServidor } from "@/lib/supabase/server";
import { errorJson } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { verificarCaptcha } from "@/lib/turnstile";
import { ipDe } from "@/lib/peticion";
import { limitarAuth } from "@/lib/limite";
import { auditarIngresoStaff } from "@/lib/api";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const limite = await limitarAuth(req, "login", body?.email);
  if (limite) return limite;
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return errorJson("Datos inválidos", 400);
  const captcha = await verificarCaptcha(body?.captchaToken, ipDe(req));
  if (captcha) return errorJson(captcha, 400);

  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/banned/i.test(error.message)) {
      return errorJson("Tu cuenta está desactivada. Habla con un administrador de PrimerPaso.", 403);
    }
    if (/not confirmed/i.test(error.message)) {
      return errorJson("Tu email aún no está verificado. Ingresa con un código.", 403);
    }
    return errorJson("Email o contraseña incorrectos", 401);
  }
  await auditarIngresoStaff(data.user.id, "password", ipDe(req));
  return Response.json({ ok: true });
}
