// Auditoría para el admin: las últimas 50 acciones registradas.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirUsuario, manejar } from "@/lib/api";

export const GET = manejar(async () => {
  await exigirUsuario(["admin"]);
  const { data, error } = await supabaseAdmin()
    .from("audit_logs")
    .select("id, action, entity, entity_id, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return Response.json({ registros: data });
});
