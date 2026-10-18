// Elige el rol en el registro: estudiante o garante. Los roles de staff
// (operator, admin) solo los asigna un administrador.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, errorJson } from "@/lib/auth";
import { rolSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return errorJson("No autenticado", 401);
  if (user.esStaff) return errorJson("El personal de PrimerPaso no cambia de rol aquí", 403);

  const parsed = rolSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorJson("Rol inválido", 400);
  const { role, invitationCode } = parsed.data;
  const db = supabaseAdmin();

  // Garante con código: se vincula a la invitación del estudiante.
  if (role === "guarantor" && invitationCode) {
    const { data: inv } = await db
      .from("guarantor_invitations")
      .select("id, student_id, status, expires_at")
      .eq("code", invitationCode.trim().toLowerCase())
      .maybeSingle();
    if (!inv || inv.status !== "pending" || new Date(inv.expires_at) < new Date()) {
      return errorJson("Código de invitación inválido o vencido", 400);
    }
    if (inv.student_id === user.id) return errorJson("No puedes ser tu propio garante", 400);
    await db
      .from("guarantor_invitations")
      .update({ guarantor_id: user.id, status: "accepted" })
      .eq("id", inv.id);
  }

  const { error } = await db.from("profiles").update({ role }).eq("id", user.id);
  if (error) return errorJson(error.message, 500);
  await db.auth.admin.updateUserById(user.id, { user_metadata: { role } });
  return Response.json({ ok: true, role });
}
