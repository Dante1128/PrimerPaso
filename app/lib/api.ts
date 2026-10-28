// Helpers comunes de las API routes.
import "server-only";
import { connection } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { getSessionUser, revisarSesionStaff, type Rol, type Usuario } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export class ErrorApi extends Error {
  constructor(
    message: string,
    public status = 400,
    /** Código para que el cliente reaccione (ej. MFA_REQUERIDO). */
    public codigo?: string,
  ) {
    super(message);
  }
}

/**
 * Usuario con sesión y, si se indica, con uno de los roles permitidos. Al
 * staff además le aplica sus reglas: MFA (si REQUIRE_STAFF_MFA=true), sesión
 * de 12 horas y nunca por Google.
 */
export async function exigirUsuario(roles?: Rol[]): Promise<Usuario> {
  const user = await getSessionUser();
  if (!user) throw new ErrorApi("No autenticado", 401);
  const staff = revisarSesionStaff(user);
  if (!staff.ok) {
    if (staff.codigo === "MFA_REQUERIDO") throw new ErrorApi(staff.mensaje, 403, staff.codigo);
    await (await supabaseServidor()).auth.signOut({ scope: "local" });
    throw new ErrorApi(staff.mensaje, 401, staff.codigo);
  }
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
      const codigo = e instanceof ErrorApi ? e.codigo : undefined;
      return Response.json(codigo ? { error: mensaje, codigo } : { error: mensaje }, { status });
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

/** Registra el ingreso si la cuenta es de staff (operator o admin). */
export async function auditarIngresoStaff(userId: string, metodo: "password" | "codigo", ip: string) {
  const { data } = await supabaseAdmin().from("profiles").select("role").eq("id", userId).maybeSingle();
  if (data?.role === "operator" || data?.role === "admin") {
    await auditar(userId, "staff_login", "auth", userId, { metodo, ip, rol: data.role });
  }
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

export const linkTx = (hash?: string) => (hash ? `https://stellar.expert/explorer/${process.env.NEXT_PUBLIC_STELLAR_NETWORK === "PUBLIC" ? "public" : "testnet"}/tx/${hash}` : undefined);
