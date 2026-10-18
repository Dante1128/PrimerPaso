// Cliente de Supabase para el servidor con la sesión del usuario (cookies).
// Respeta la RLS: lee solo lo que el usuario puede ver.
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

export async function supabaseServidor() {
  const store = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (lista) => {
          try {
            for (const { name, value, options } of lista) store.set(name, value, options);
          } catch {
            // Desde un Server Component no se pueden escribir cookies; el
            // proxy se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
