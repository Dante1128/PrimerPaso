// Notificaciones del usuario: GET las últimas 20, PATCH las marca como leídas.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirUsuario, manejar, ErrorApi } from "@/lib/api";

export const GET = manejar(async () => {
  const user = await exigirUsuario();
  const { data, error } = await supabaseAdmin()
    .from("notifications")
    .select("id, type, payload, read_at, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new ErrorApi(error.message, 500);
  return Response.json({ notificaciones: data });
});

export const PATCH = manejar(async () => {
  const user = await exigirUsuario();
  const { error } = await supabaseAdmin()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .is("read_at", null);
  if (error) throw new ErrorApi(error.message, 500);
  return Response.json({ ok: true });
});
