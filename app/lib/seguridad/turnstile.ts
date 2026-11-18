// CAPTCHA de Cloudflare Turnstile, validado en el servidor. Solo se exige si
// TURNSTILE_SECRET_KEY está definida (vacía en testnet: la demo no cambia).
import "server-only";

const VERIFICAR = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const captchaActivo = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

/** null si pasa (o no se exige); si no, el mensaje para el usuario. */
export async function verificarCaptcha(token: unknown, ip?: string | null): Promise<string | null> {
  const secreto = process.env.TURNSTILE_SECRET_KEY;
  if (!secreto) return null;
  if (typeof token !== "string" || !token) return "Completa la verificación de seguridad.";

  const cuerpo = new URLSearchParams({ secret: secreto, response: token });
  if (ip) cuerpo.set("remoteip", ip);
  try {
    const r = await fetch(VERIFICAR, { method: "POST", body: cuerpo });
    const d = (await r.json()) as { success?: boolean };
    return d.success ? null : "La verificación de seguridad falló. Vuelve a intentarlo.";
  } catch {
    return "No pudimos validar la verificación de seguridad. Intenta de nuevo.";
  }
}
