// Crea la cuenta y envía el código de verificación al email (Supabase Auth).
import { supabaseServidor } from "@/lib/supabase/server";
import { errorJson } from "@/lib/auth";
import { registroSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const parsed = registroSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Datos inválidos", detalles: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { fullName, email, password } = parsed.data;

  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return errorJson(traducir(error.message), 400);
  // Supabase no revela si el email ya existe: devuelve un usuario sin identidades.
  if (data.user && data.user.identities?.length === 0) {
    return errorJson("Ya existe una cuenta con ese email. Ingresa o pide un código.", 409);
  }
  return Response.json({ ok: true, email });
}

function traducir(msg: string): string {
  if (/rate limit/i.test(msg)) return "Se enviaron demasiados emails. Espera unos minutos e intenta de nuevo.";
  if (/password/i.test(msg)) return "La contraseña no cumple los requisitos.";
  return msg;
}
