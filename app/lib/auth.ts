// Sesión del usuario con Supabase Auth.
//
// La identidad sale de la cookie de sesión (validada con Supabase). Los
// datos del perfil se leen con el cliente admin, solo para el propio
// usuario: así una política RLS mal configurada no deja a alguien sin panel.
import "server-only";
import { createHash } from "node:crypto";
import { supabaseServidor } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Enums, Tables } from "@/lib/database.types";
import { evaluarSesionStaff, exigeMfaStaff, leerSesionDelToken, type SesionAuth } from "@/lib/politica-staff";

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
  /** Motivo del último rechazo del KYC (lo escribe el operador). */
  kycMotivo: string | null;
  wallet: string | null;
  /** aal y métodos de ingreso de esta sesión (para las reglas del staff). */
  sesion: SesionAuth;
  /** Tiene un TOTP verificado en Supabase MFA. */
  mfaConfigurado: boolean;
};

/** Devuelve el usuario de la sesión actual, o null. */
export async function getSessionUser(): Promise<Usuario | null> {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Cuenta desactivada por un admin (ban de Supabase).
  const baneadoHasta = (user as { banned_until?: string }).banned_until;
  if (baneadoHasta && new Date(baneadoHasta) > new Date()) return null;
  // El token ya lo validó getUser; de él leemos aal y amr.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const db = supabaseAdmin();
  const [perfil, estudiante, kyc, wallet] = await Promise.all([
    db.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
    db.from("student_profiles").select("*").eq("profile_id", user.id).maybeSingle(),
    db
      .from("kyc_submissions")
      .select("status, rejection_reason")
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
    rolElegido: rolYaElegido(esStaff, user, Boolean(estudiante.data || kyc.data)),
    esStaff,
    estudiante: estudiante.data ?? null,
    kycStatus: kyc.data?.status ?? null,
    kycMotivo: kyc.data?.status === "rejected" ? (kyc.data.rejection_reason ?? null) : null,
    wallet: wallet.data?.address ?? null,
    sesion: leerSesionDelToken(session?.access_token),
    mfaConfigurado: (user.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified"),
  };
}

/**
 * El rol se fija una sola vez. `app_metadata` solo lo escribe el servidor;
 * `user_metadata` lo traen las cuentas del seed y las anteriores a este
 * cambio. Si ya avanzó en el registro (universidad o KYC), también — pero
 * OJO: la wallet NO cuenta acá, porque con el login de Pollar la wallet
 * queda vinculada desde el primer paso, antes de elegir rol.
 */
function rolYaElegido(
  esStaff: boolean,
  user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> },
  avanzoRegistro: boolean,
): boolean {
  return esStaff || Boolean(user.app_metadata?.role) || Boolean(user.user_metadata?.role) || avanzoRegistro;
}

/** Reglas del staff aplicadas a la sesión actual (ver lib/politica-staff). */
export function revisarSesionStaff(u: Usuario) {
  return evaluarSesionStaff({ esStaff: u.esStaff, sesion: u.sesion, exigirMfa: exigeMfaStaff(), ahora: Math.floor(Date.now() / 1000) });
}

/**
 * Siguiente paso pendiente del registro, o null si ya terminó. "cuenta" es
 * el login social de Pollar, que de paso vincula la wallet (SEP-10) — por
 * eso va primero: sin wallet no hay nada más que pedir.
 */
export function pasoPendiente(u: Usuario): "cuenta" | "rol" | "universidad" | "identidad" | null {
  if (u.esStaff) return null;
  if (!u.wallet) return "cuenta";
  if (!u.rolElegido) return "rol";
  if (u.role === "student" && !u.estudiante) return "universidad";
  if (!u.kycStatus) return "identidad";
  return null;
}

/**
 * Email sintético y determinístico para quien entra solo con wallet (login
 * social de Pollar, sin password): no es un correo real, nunca se envía nada
 * ahí, solo identifica la cuenta de Supabase Auth de forma única por dirección.
 */
function emailDeWallet(address: string): string {
  const hash = createHash("sha256").update(address).digest("hex").slice(0, 32);
  return `pollar-${hash}@wallet.primerpaso.local`;
}

/**
 * Abre sesión a partir de una wallet ya verificada por SEP-10 (la firmó
 * Pollar), sin contraseña: crea la cuenta si es la primera vez, o reabre
 * sesión si ya existía. Devuelve el id del perfil (= auth.users.id).
 */
export async function abrirSesionPorWallet(address: string, fullName?: string): Promise<string> {
  const email = emailDeWallet(address);
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({
    type: "magiclink",
    email,
    options: fullName ? { data: { full_name: fullName } } : undefined,
  });
  if (error || !data.properties || !data.user) throw new Error(error?.message ?? "No se pudo abrir la sesión");

  const supabase = await supabaseServidor();
  const { error: errorVerificar } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (errorVerificar) throw new Error(errorVerificar.message);
  return data.user.id;
}

/** Respuesta JSON de error estándar para las API routes. */
export function errorJson(mensaje: string, status: number) {
  return Response.json({ error: mensaje }, { status });
}
