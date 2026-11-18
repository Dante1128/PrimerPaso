// Datos de la petición HTTP que usan las reglas de seguridad.
import "server-only";

/** IP del cliente (detrás de Vercel u otro proxy, la primera de x-forwarded-for). */
export function ipDe(req: Request): string {
  const reenviada = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada || req.headers.get("x-real-ip") || "local";
}
