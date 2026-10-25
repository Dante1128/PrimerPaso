"use client";
// Enlaces de email que traen la sesión en el #hash (ej. la invitación de un
// operador). El servidor no ve el hash: aquí se abre la sesión en el navegador.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseNavegador } from "@/lib/supabase/client";
import { Alerta, Spinner } from "@/components/ui";

async function abrirSesionDelHash(): Promise<string | null> {
  const p = new URLSearchParams(window.location.hash.slice(1));
  const access_token = p.get("access_token");
  const refresh_token = p.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  const { error } = await supabaseNavegador().auth.setSession({ access_token, refresh_token });
  if (error) return null;
  const { user } = await (await fetch("/api/auth/me")).json();
  return user?.pasoPendiente ? "/registro" : "/panel";
}

export default function ConfirmarPage() {
  const router = useRouter();
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    abrirSesionDelHash().then((destino) => (destino ? router.replace(destino) : setFallo(true)));
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      {fallo ? (
        <div className="max-w-md space-y-3 text-center">
          <Alerta tipo="error">El enlace no es válido o ya venció.</Alerta>
          <Link href="/ingresar" className="font-semibold text-brandink">
            Ir a ingresar
          </Link>
        </div>
      ) : (
        <Spinner className="h-6 w-6" />
      )}
    </main>
  );
}
