// Lógica compartida del flujo on-chain de un préstamo (solicitud aprobada →
// depósito de garantía → apertura) y de los pagos.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ErrorApi } from "@/lib/api";
import type { Usuario } from "@/lib/auth";
import type { Tables } from "@/lib/database.types";

/** Wallet principal de un perfil. */
export async function walletDe(profileId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("wallets")
    .select("address")
    .eq("profile_id", profileId)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  return data?.address ?? null;
}

/** Solicitud aprobada sobre la que el usuario puede actuar (estudiante o su garante). */
export async function solicitudParaActuar(applicationId: string, user: Usuario) {
  const { data: app } = await supabaseAdmin().from("loan_applications").select("*").eq("id", applicationId).maybeSingle();
  if (!app) throw new ErrorApi("Solicitud no encontrada", 404);
  const esEstudiante = app.student_id === user.id;
  const esGarante = app.guarantor_id === user.id;
  if (!esEstudiante && !esGarante) throw new ErrorApi("Esta solicitud no es tuya", 403);
  if (app.status !== "approved") throw new ErrorApi("La solicitud no está aprobada (o ya se abrió el préstamo)");
  if (!user.wallet) throw new ErrorApi("Primero vincula tu wallet");
  const walletEstudiante = esEstudiante ? user.wallet : await walletDe(app.student_id);
  if (!walletEstudiante) throw new ErrorApi("El estudiante aún no vinculó su wallet");
  return { app, esEstudiante, esGarante, walletEstudiante };
}

/** Posición de garantía depositada para la solicitud (registrada al enviar el depósito). */
export async function posicionDeSolicitud(app: Tables<"loan_applications">): Promise<number | null> {
  const { data: preparada, error } = await supabaseAdmin().from("prepared_transactions")
    .select("result").eq("entity_id", app.id).eq("method", "deposit_collateral")
    .not("confirmed_at", "is", null).order("confirmed_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new ErrorApi("No se pudo consultar la garantía", 503);
  const positionId = (preparada?.result as { positionId?: number } | null)?.positionId;
  if (positionId) return positionId;
  const { data } = await supabaseAdmin()
    .from("audit_logs")
    .select("data")
    .eq("action", "collateral_deposited")
    .eq("entity", "loan_application")
    .eq("entity_id", app.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pos = (data?.data as { position_id?: number } | null)?.position_id;
  return pos ? Number(pos) : null;
}

/**
 * ¿El usuario puede ver/pagar este préstamo? Prestatario, depositante, el
 * garante de la solicitud o staff.
 */
export async function puedeVerPrestamo(
  loan: Pick<Tables<"loans">, "student_id" | "depositor_address" | "borrower_address" | "application_id">,
  user: Usuario,
): Promise<boolean> {
  if (user.esStaff || loan.student_id === user.id) return true;
  if (user.wallet && [loan.depositor_address, loan.borrower_address].includes(user.wallet)) return true;
  if (user.role === "guarantor" && loan.application_id) {
    const { data } = await supabaseAdmin().from("loan_applications").select("guarantor_id").eq("id", loan.application_id).maybeSingle();
    return data?.guarantor_id === user.id;
  }
  return false;
}
