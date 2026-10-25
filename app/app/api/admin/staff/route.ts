// Equipo de PrimerPaso (solo admin; con MFA si REQUIRE_STAFF_MFA=true).
//   GET   lista el staff (operadores y admins)
//   POST  invita un operador por correo { email, fullName }
//   PATCH activa o desactiva un operador { id, activo }
// Un admin no puede quitarse su rol ni desactivarse: solo se gestionan operadores.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirUsuario, manejar, ErrorApi, auditar } from "@/lib/api";
import { estadoStaffSchema, invitarStaffSchema } from "@/lib/validation";

/** Desactivar = ban de Supabase: no puede ingresar ni renovar su sesión. */
const BAN_INDEFINIDO = "876000h";

export const GET = manejar(async () => {
  await exigirUsuario(["admin"]);
  const db = supabaseAdmin();
  const [{ data: perfiles, error }, usuarios] = await Promise.all([
    db.from("profiles").select("id, full_name, role, created_at").in("role", ["operator", "admin"]).order("created_at"),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (error) throw new Error(error.message);
  const porId = new Map((usuarios.data?.users ?? []).map((u) => [u.id, u]));

  const staff = (perfiles ?? []).map((p) => {
    const u = porId.get(p.id);
    const baneado = (u as { banned_until?: string } | undefined)?.banned_until;
    return {
      id: p.id,
      nombre: p.full_name,
      email: u?.email ?? "",
      rol: p.role,
      activo: !(baneado && new Date(baneado) > new Date()),
      mfa: (u?.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified"),
      ultimoIngreso: u?.last_sign_in_at ?? null,
      invitacionPendiente: Boolean(u?.invited_at && !u?.last_sign_in_at),
    };
  });
  return Response.json({ staff });
});

export const POST = manejar(async (req: Request) => {
  const admin = await exigirUsuario(["admin"]);
  const parsed = invitarStaffSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ErrorApi(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const { email, fullName } = parsed.data;
  const db = supabaseAdmin();

  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role: "operator" },
    redirectTo: `${new URL(req.url).origin}/auth/callback`,
  });
  if (error) {
    if (/already been registered|already exists/i.test(error.message)) {
      throw new ErrorApi("Ya existe una cuenta con ese correo. El rol de una cuenta existente no se cambia.", 409);
    }
    throw new ErrorApi(`No se pudo enviar la invitación: ${error.message}`, 502);
  }

  const id = data.user.id;
  // El trigger crea el perfil como estudiante; aquí se le asigna el rol.
  const { error: e2 } = await db.from("profiles").upsert({ id, full_name: fullName, role: "operator" }, { onConflict: "id" });
  if (e2) throw new Error(e2.message);
  await db.auth.admin.updateUserById(id, { app_metadata: { role: "operator" } });

  await auditar(admin.id, "staff_invited", "profile", id, { email, role: "operator" });
  return Response.json({ ok: true, id });
});

export const PATCH = manejar(async (req: Request) => {
  const admin = await exigirUsuario(["admin"]);
  const parsed = estadoStaffSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ErrorApi("Datos inválidos");
  const { id, activo } = parsed.data;
  if (id === admin.id) throw new ErrorApi("No puedes desactivarte ni quitarte tu propio rol", 403);

  const db = supabaseAdmin();
  const { data: perfil } = await db.from("profiles").select("role").eq("id", id).maybeSingle();
  if (perfil?.role !== "operator") throw new ErrorApi("Solo se pueden activar o desactivar operadores", 400);

  const { error } = await db.auth.admin.updateUserById(id, { ban_duration: activo ? "none" : BAN_INDEFINIDO });
  if (error) throw new Error(error.message);
  await auditar(admin.id, activo ? "staff_reactivated" : "staff_deactivated", "profile", id);
  return Response.json({ ok: true });
});
