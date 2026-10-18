// Revisión de KYC por el operador.
//  GET  → solicitudes (por defecto "pending") con enlaces firmados a los documentos (10 min).
//  POST → aprobar o rechazar.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirUsuario, manejar, ErrorApi, auditar, notificar } from "@/lib/api";
import { revisionSchema } from "@/lib/validation";
import type { Enums } from "@/lib/database.types";

export const GET = manejar(async (req: Request) => {
  await exigirUsuario(["operator", "admin"]);
  const status = (new URL(req.url).searchParams.get("status") ?? "pending") as Enums<"kyc_status">;
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("kyc_submissions")
    .select("id, profile_id, status, sep12_fields, document_paths, rejection_reason, created_at, profile:profiles!kyc_submissions_profile_id_fkey(full_name, role)")
    .eq("status", status)
    .order("created_at", { ascending: true });
  if (error) throw new ErrorApi(error.message, 500);

  const conEnlaces = await Promise.all(
    (data ?? []).map(async (k) => {
      const documentos = await Promise.all(
        k.document_paths.map(async (path) => {
          const { data: url } = await db.storage.from("kyc-docs").createSignedUrl(path, 600);
          return { path, url: url?.signedUrl ?? null };
        }),
      );
      return { ...k, documentos };
    }),
  );
  return Response.json({ kyc: conEnlaces });
});

export const POST = manejar(async (req: Request) => {
  const user = await exigirUsuario(["operator", "admin"]);
  const parsed = revisionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ErrorApi(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const { id, decision, reason } = parsed.data;
  if (decision === "reject" && !reason) throw new ErrorApi("Indica el motivo del rechazo");

  const db = supabaseAdmin();
  const { data: k } = await db.from("kyc_submissions").select("profile_id, status").eq("id", id).maybeSingle();
  if (!k) throw new ErrorApi("KYC no encontrado", 404);
  if (k.status !== "pending") throw new ErrorApi("Este KYC ya fue revisado");

  const ahora = new Date().toISOString();
  const { error } = await db
    .from("kyc_submissions")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      reviewed_by: user.id,
      reviewed_at: ahora,
      rejection_reason: decision === "reject" ? reason : null,
      updated_at: ahora,
    })
    .eq("id", id);
  if (error) throw new ErrorApi(error.message, 500);

  await auditar(user.id, decision === "approve" ? "kyc_approved" : "kyc_rejected", "kyc_submission", id, { reason });
  await notificar(k.profile_id, decision === "approve" ? "kyc_approved" : "kyc_rejected", { reason });
  return Response.json({ ok: true });
});
