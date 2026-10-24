// Helpers comunes de las API routes.
import "server-only";
import { connection } from "next/server";
import { getSessionUser, type Rol, type Usuario } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export class ErrorApi extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Usuario con sesión y, si se indica, con uno de los roles permitidos. */
export async function exigirUsuario(roles?: Rol[]): Promise<Usuario> {
  const user = await getSessionUser();
  if (!user) throw new ErrorApi("No autenticado", 401);
  if (roles && !roles.includes(user.role)) throw new ErrorApi("No tienes permiso para esta acción", 403);
  return user;
}

/** Envuelve un handler: convierte errores en respuestas JSON. */
export function manejar<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    // Siempre dinámica (sesión, cadena en vivo). Va fuera del try: durante el
    // build Next la usa para saltar el prerender y no debe atraparse.
    await connection();
    try {
      return await fn(...args);
    } catch (e) {
      const status = e instanceof ErrorApi ? e.status : 400;
      const mensaje = e instanceof Error ? e.message : "Ocurrió un error";
      if (!(e instanceof ErrorApi)) console.error("[api]", e);
      return Response.json({ error: mensaje }, { status });
    }
  };
}

/** Registro de auditoría de acciones relevantes. */
export async function auditar(actorId: string | null, action: string, entity: string, entityId: string | null, data?: unknown) {
  await supabaseAdmin()
    .from("audit_logs")
    .insert({
      actor_id: actorId,
      action,
      entity,
      entity_id: entityId,
      data: (data ?? null) as Json,
    });
}

/** Notificación para un usuario (se muestra en su panel). */
export async function notificar(profileId: string, type: string, payload: Record<string, unknown>) {
  await supabaseAdmin()
    .from("notifications")
    .insert({ profile_id: profileId, type, channel: "in_app", payload: payload as NonNullable<Json> });
}

/**
 * Duración de cada cuota en segundos. En producción, un mes (30 días); en
 * la demo de testnet se acorta con LOAN_PERIOD_SECONDS para ver vencimientos.
 */
export function periodoSegundos(): number {
  const v = Number(process.env.LOAN_PERIOD_SECONDS ?? 2_592_000);
  return Number.isFinite(v) && v >= 60 ? Math.floor(v) : 2_592_000;
}

export const linkTx = (hash?: string) => (hash ? `https://stellar.expert/explorer/testnet/tx/${hash}` : undefined);
