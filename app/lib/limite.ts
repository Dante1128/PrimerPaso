// Límite de intentos en /api/auth/*: por defecto 10 por minuto por IP y por
// correo, en cada ruta. El contador vive en Postgres (migración 0004).
//   AUTH_RATE_LIMIT=false     lo apaga (no recomendado)
//   AUTH_RATE_LIMIT_MAX=10    intentos por minuto
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ipDe } from "@/lib/peticion";

export const MENSAJE_LIMITE = "Demasiados intentos. Espera un minuto e intenta de nuevo.";
const VENTANA_SEGUNDOS = 60;

const activo = () => process.env.AUTH_RATE_LIMIT !== "false";
function maximo(): number {
  const n = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
}

/** Suma un intento. Devuelve la respuesta 429 si se pasó del límite, o null. */
export async function limitarAuth(req: Request, ruta: string, email?: unknown): Promise<Response | null> {
  if (!activo()) return null;
  const claves = [`${ruta}:ip:${ipDe(req)}`];
  if (typeof email === "string" && email.trim()) claves.push(`${ruta}:email:${email.trim().toLowerCase()}`);

  try {
    const resultados = await Promise.all(
      claves.map((p_key) =>
        supabaseAdmin().rpc("auth_rate_limit_hit", { p_key, p_max: maximo(), p_window_seconds: VENTANA_SEGUNDOS }),
      ),
    );
    const fallo = resultados.find((r) => r.error);
    if (fallo?.error) throw new Error(fallo.error.message);
    if (resultados.some((r) => r.data === false)) {
      return Response.json({ error: MENSAJE_LIMITE }, { status: 429, headers: { "Retry-After": String(VENTANA_SEGUNDOS) } });
    }
  } catch (e) {
    // Si la base no responde no se bloquea el ingreso (Supabase Auth tiene su propio límite).
    console.error("[limite]", e);
  }
  return null;
}
