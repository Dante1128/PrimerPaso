import { supabaseServidor } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  return Response.json({ ok: true });
}
