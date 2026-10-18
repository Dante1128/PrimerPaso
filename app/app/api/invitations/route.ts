// Invitaciones de garante: el estudiante invita por email y comparte el
// código; el garante lo usa al registrarse (POST /api/auth/role).
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, errorJson } from "@/lib/auth";
import { invitacionSchema } from "@/lib/validation";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorJson("No autenticado", 401);
  const { data, error } = await supabaseAdmin()
    .from("guarantor_invitations")
    .select("code, guarantor_email, status, expires_at, created_at, guarantor:profiles!guarantor_invitations_guarantor_id_fkey(full_name)")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return errorJson(error.message, 500);
  return Response.json({ invitaciones: data });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return errorJson("No autenticado", 401);
  if (user.role !== "student") return errorJson("Solo los estudiantes invitan garantes", 403);

  const parsed = invitacionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorJson("Email inválido", 400);
  if (parsed.data.guarantorEmail === user.email) return errorJson("No puedes ser tu propio garante", 400);

  const { data, error } = await supabaseAdmin()
    .from("guarantor_invitations")
    .insert({ student_id: user.id, guarantor_email: parsed.data.guarantorEmail })
    .select("code, expires_at")
    .single();
  if (error) return errorJson(error.message, 500);
  return Response.json({ ok: true, ...data });
}
