// Sesión del usuario con Supabase Auth.
//
// La identidad sale de la cookie de sesión (validada con Supabase). Los
// datos del perfil se leen con el cliente admin, solo para el propio
// usuario: así una política RLS mal configurada no deja a alguien sin panel.
import "server-only";
import { supabaseServidor } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Enums, Tables } from "@/lib/database.types";

export type Rol = Enums<"user_role">;

export type Usuario = {
  id: string;
  email: string;
  fullName: string | null;
  role: Rol;
  /** El usuario ya eligió rol en el registro (o es staff). Nunca se cambia. */
  rolElegido: boolean;
  esStaff: boolean;
  estudiante: Tables<"student_profiles"> | null;
  kycStatus: Enums<"kyc_status"> | null;
  wallet: string | null;
};

/** Devuelve el usuario de la sesión actual, o null. */
export async function getSessionUser(): Promise<Usuario | null> {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = supabaseAdmin();
  const [perfil, estudiante, kyc, wallet] = await Promise.all([
    db.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
    db.from("student_profiles").select("*").eq("profile_id", user.id).maybeSingle(),
    db
      .from("kyc_submissions")
      .select("status")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("wallets")
      .select("address")
      .eq("profile_id", user.id)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle(),
  ]);

  const role: Rol = perfil.data?.role ?? "student";
  const esStaff = role === "operator" || role === "admin";
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: perfil.data?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    role,
    rolElegido: rolYaElegido(esStaff, user, Boolean(estudiante.data || kyc.data || wallet.data)),
    esStaff,
    estudiante: estudiante.data ?? null,
    kycStatus: kyc.data?.status ?? null,
    wallet: wallet.data?.address ?? null,
  };
}

/**
 * El rol se fija una sola vez. `app_metadata` solo lo escribe el servidor;
 * `user_metadata` lo traen las cuentas del seed y las anteriores a este
 * cambio. Si ya avanzó en el registro (universidad, KYC o wallet), también.
 */
function rolYaElegido(
  esStaff: boolean,
  user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> },
  avanzoRegistro: boolean,
): boolean {
  return esStaff || Boolean(user.app_metadata?.role) || Boolean(user.user_metadata?.role) || avanzoRegistro;
}

/** Siguiente paso pendiente del registro, o null si ya terminó. */
export function pasoPendiente(u: Usuario): "rol" | "universidad" | "identidad" | "wallet" | null {
  if (u.esStaff) return null;
  if (!u.rolElegido) return "rol";
  if (u.role === "student" && !u.estudiante) return "universidad";
  if (!u.kycStatus) return "identidad";
  if (!u.wallet) return "wallet";
  return null;
}

/** Respuesta JSON de error estándar para las API routes. */
export function errorJson(mensaje: string, status: number) {
  return Response.json({ error: mensaje }, { status });
}
