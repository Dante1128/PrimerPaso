// Ingreso con email y contraseña.
import { supabaseServidor } from "@/lib/supabase/server";
import { errorJson } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson("Datos inválidos", 400);

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/not confirmed/i.test(error.message)) {
      return errorJson("Tu email aún no está verificado. Ingresa con un código.", 403);
    }
    return errorJson("Email o contraseña incorrectos", 401);
  }
  return Response.json({ ok: true });
}
