// Vuelta de Google (OAuth con PKCE: ?code=) y de los enlaces de email de
// Supabase (?token_hash=&type=, ej. la invitación de un operador).
// Abre la sesión y manda al panel, o al registro si falta un paso (ej. el rol).
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServidor } from "@/lib/supabase/server";
import { getSessionUser, pasoPendiente } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, url.origin));
  const supabase = await supabaseServidor();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("sin código") };
  if (error) return ir("/ingresar?error=enlace");

  const user = await getSessionUser();
  if (!user) return ir("/ingresar?error=enlace");

  // Google es solo para estudiantes y garantes: el staff entra con contraseña o código.
  if (code && user.esStaff) {
    await supabase.auth.signOut();
    return ir("/ingresar?error=staff_google");
  }
  return ir(pasoPendiente(user) ? "/registro" : "/panel");
}
