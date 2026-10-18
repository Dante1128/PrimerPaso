// Cliente de Supabase con la SECRET KEY: salta la RLS. Solo en el servidor,
// solo para escrituras validadas en API routes. Nunca importar desde el cliente.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let cliente: ReturnType<typeof createClient<Database>> | null = null;

export function supabaseAdmin() {
  if (!cliente) {
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret) throw new Error("Falta SUPABASE_SECRET_KEY en .env.local");
    cliente = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cliente;
}
