// Elige el rol en el registro: estudiante o garante, una sola vez. Los roles
// de staff (operator, admin) solo los asigna un administrador.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, errorJson } from "@/lib/auth";
import { rolSchema } from "@/lib/validation";
import { limitarAuth } from "@/lib/limite";
import { aceptarInvitacion } from "@/lib/invitaciones";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return errorJson("No autenticado", 401);
  const limite = await limitarAuth(req, "role", user.email);
  if (limite) return limite;
  // Nunca se cambia de rol después del registro (incluye al staff).
  if (user.rolElegido) return errorJson("El rol ya fue elegido", 409);

  const parsed = rolSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorJson("Rol inválido", 400);
  const { role, invitationCode } = parsed.data;
  const db = supabaseAdmin();

  // Garante con código: se vincula a la invitación del estudiante.
  if (role === "guarantor" && invitationCode) {
    const fallo = await aceptarInvitacion(user.id, invitationCode);
    if (fallo) return errorJson(fallo, 400);
  }

  const { error } = await db.from("profiles").update({ role }).eq("id", user.id);
  if (error) return errorJson(error.message, 500);
  // app_metadata no la puede editar el usuario: es la fuente que fija el rol.
  await db.auth.admin.updateUserById(user.id, { app_metadata: { role }, user_metadata: { role } });
  return Response.json({ ok: true, role });
}
