// Vincular a un garante con el estudiante que lo invitó (por código).
// Lo usan el registro (al elegir el rol de garante) y el panel del garante.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** null si quedó vinculado; si no, el mensaje para el usuario. */
export async function aceptarInvitacion(garanteId: string, codigo: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data: inv } = await db
    .from("guarantor_invitations")
    .select("id, student_id, status, expires_at")
    .eq("code", codigo.trim().toLowerCase())
    .maybeSingle();
  if (!inv || inv.status !== "pending" || new Date(inv.expires_at) < new Date()) {
    return "Código de invitación inválido o vencido. Pídele al estudiante uno nuevo.";
  }
  if (inv.student_id === garanteId) return "No puedes ser tu propio garante";

  // Solo si sigue pendiente: dos personas no pueden usar el mismo código.
  const { data, error } = await db
    .from("guarantor_invitations")
    .update({ guarantor_id: garanteId, status: "accepted" })
    .eq("id", inv.id)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ? null : "Ese código ya fue usado.";
}
