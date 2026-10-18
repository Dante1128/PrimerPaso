// El operador aprueba o rechaza una solicitud. Para aprobar, el KYC del
// estudiante debe estar aprobado y el pool debe tener liquidez.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirUsuario, manejar, ErrorApi, auditar, notificar } from "@/lib/api";
import { revisionSchema } from "@/lib/validation";
import { aStroops, poolDisponible } from "@/lib/soroban";

export const POST = manejar(async (req: Request) => {
  const user = await exigirUsuario(["operator", "admin"]);
  const parsed = revisionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ErrorApi(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const { id, decision, reason } = parsed.data;

  const db = supabaseAdmin();
  const { data: app } = await db.from("loan_applications").select("*").eq("id", id).maybeSingle();
  if (!app) throw new ErrorApi("Solicitud no encontrada", 404);
  if (app.status !== "submitted") throw new ErrorApi("La solicitud ya fue revisada");

  if (decision === "approve") {
    const { data: kyc } = await db
      .from("kyc_submissions")
      .select("status")
      .eq("profile_id", app.student_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (kyc?.status !== "approved") throw new ErrorApi("El KYC del estudiante aún no está aprobado");
    if ((await poolDisponible()) < aStroops(app.amount_usd)) throw new ErrorApi("El pool no tiene liquidez suficiente");
  } else if (!reason) {
    throw new ErrorApi("Indica el motivo del rechazo");
  }

  const { error } = await db
    .from("loan_applications")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      reviewed_by: user.id,
      rejection_reason: decision === "reject" ? reason : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new ErrorApi(error.message, 500);

  await auditar(user.id, decision === "approve" ? "application_approved" : "application_rejected", "loan_application", id, { reason });
  await notificar(app.student_id, decision === "approve" ? "application_approved" : "application_rejected", {
    application_id: id,
    reason,
  });
  return Response.json({ ok: true });
});
