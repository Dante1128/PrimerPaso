// Datos universitarios del estudiante (student_profiles).
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, errorJson } from "@/lib/auth";
import { universidadSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return errorJson("No autenticado", 401);
  if (user.role !== "student") return errorJson("Solo para estudiantes", 403);

  const parsed = universidadSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: "Datos inválidos", detalles: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const { error } = await supabaseAdmin()
    .from("student_profiles")
    .upsert(
      {
        profile_id: user.id,
        university_name: d.universityName,
        career: d.career,
        student_code: d.studentCode || null,
        semester: d.semester,
      },
      { onConflict: "profile_id" },
    );
  if (error) return errorJson(error.message, 500);
  return Response.json({ ok: true });
}
