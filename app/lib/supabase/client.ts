"use client";
// Cliente de Supabase para el navegador. Solo LEE (la RLS limita qué ve
// cada usuario); toda escritura pasa por las API routes del servidor.
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

export function supabaseNavegador() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
