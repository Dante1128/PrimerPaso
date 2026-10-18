"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { Campo, inputClase, Boton, Alerta, Spinner } from "@/components/ui";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo ingresar");
      // Si aún no terminó el onboarding, el flujo de registro lo retoma.
      if (!data.emailVerified || !data.role || !data.hasWallet) {
        router.replace("/registro");
      } else {
        router.replace("/panel");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-teal-50/60 to-white px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-block">
          <Logo />
        </Link>
        <form
          onSubmit={enviar}
          className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <h1 className="text-xl font-bold text-slate-900">Ingresar</h1>

          <Campo label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              className={inputClase}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Campo>
          <Campo label="Contraseña" htmlFor="password">
            <input
              id="password"
              type="password"
              className={inputClase}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Campo>

          {error && <Alerta tipo="error">{error}</Alerta>}

          <Boton type="submit" disabled={cargando} className="w-full">
            {cargando && <Spinner />} Ingresar
          </Boton>
          <p className="text-center text-sm text-slate-500">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-teal-600">
              Crear cuenta
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
