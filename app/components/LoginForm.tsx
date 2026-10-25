"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import BotonGoogle from "@/components/BotonGoogle";
import Turnstile, { CAPTCHA_ACTIVO } from "@/components/Turnstile";
import { Campo, inputClase, Boton, Alerta, Spinner } from "@/components/ui";

type Modo = "password" | "codigo";

async function api(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo ingresar");
  return data;
}

export default function LoginForm({ errorInicial }: { errorInicial?: string }) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [error, setError] = useState(errorInicial ?? "");
  const [cargando, setCargando] = useState(false);
  // CAPTCHA (solo si Turnstile está configurado): un token por intento.
  const [captcha, setCaptcha] = useState("");
  const [intento, setIntento] = useState(0);
  const pideCaptcha = CAPTCHA_ACTIVO && (modo === "password" || !codigoEnviado);

  /** Tras abrir sesión: al panel, o al registro si falta algún paso. */
  async function entrar() {
    const res = await fetch("/api/auth/me");
    const { user } = await res.json();
    router.replace(user?.pasoPendiente ? "/registro" : "/panel");
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      if (modo === "password") {
        await api("/api/auth/login", { email, password, captchaToken: captcha });
        await entrar();
      } else if (!codigoEnviado) {
        await api("/api/auth/code", { email, captchaToken: captcha });
        setCodigoEnviado(true);
      } else {
        await api("/api/auth/verify-email", { email, code });
        await entrar();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
      setCaptcha("");
      setIntento((n) => n + 1);
    }
  }

  function cambiarModo(m: Modo) {
    setModo(m);
    setError("");
    setCodigoEnviado(false);
    setCode("");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-teal-50/60 to-white px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-block">
          <Logo />
        </Link>
        <form onSubmit={enviar} className="mt-6 space-y-4 rounded-3xl border-2 border-ink bg-white p-8 nb-shadow-sm">
          <h1 className="text-xl font-bold text-ink">Ingresar</h1>

          <BotonGoogle />

          <div className="grid grid-cols-2 rounded-full bg-cream p-1 text-sm font-semibold">
            {(["password", "codigo"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => cambiarModo(m)}
                className={`rounded-full py-1.5 transition ${modo === m ? "bg-white text-brandink nb-shadow-sm" : "text-ink/60"}`}
              >
                {m === "password" ? "Con contraseña" : "Con código"}
              </button>
            ))}
          </div>

          <Campo label="Email" htmlFor="email">
            <input id="email" type="email" className={inputClase} value={email} onChange={(e) => setEmail(e.target.value)} required disabled={codigoEnviado} />
          </Campo>

          {modo === "password" && (
            <Campo label="Contraseña" htmlFor="password">
              <input id="password" type="password" className={inputClase} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Campo>
          )}

          {modo === "codigo" && codigoEnviado && (
            <>
              <Alerta tipo="success">Te enviamos un código a {email}.</Alerta>
              <Campo label="Código" htmlFor="code">
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  className={`${inputClase} text-center text-2xl tracking-[0.5em]`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </Campo>
            </>
          )}

          {pideCaptcha && <Turnstile key={intento} onToken={setCaptcha} />}

          {error && <Alerta tipo="error">{error}</Alerta>}

          <Boton type="submit" disabled={cargando || (pideCaptcha && !captcha)} className="w-full">
            {cargando && <Spinner />}{" "}
            {modo === "password" ? "Ingresar" : codigoEnviado ? "Verificar e ingresar" : "Enviarme un código"}
          </Boton>
          <p className="text-center text-sm text-ink/60">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-brandink">
              Crear cuenta
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
