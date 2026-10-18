"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { cortarDir } from "@/lib/format";

export default function TopBar({
  nombre,
  rol,
  wallet,
}: {
  nombre: string;
  rol: string | null;
  wallet: string | null;
}) {
  const router = useRouter();

  async function salir() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-800">{nombre}</p>
            <p className="text-xs text-slate-400">
              {{ student: "Estudiante", guarantor: "Garante", operator: "Operador", admin: "Administrador" }[rol ?? ""] ?? "—"}
              {wallet ? ` · ${cortarDir(wallet)}` : ""}
            </p>
          </div>
          <button
            onClick={salir}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-600"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
