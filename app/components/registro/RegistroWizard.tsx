"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { Campo, inputClase, Boton, Alerta, Spinner } from "@/components/ui";
import { conectarFreighter, firmarXdr } from "@/lib/wallet";

type Paso = "cuenta" | "email" | "rol" | "universidad" | "identidad" | "wallet" | "fondeo";
type Rol = "student" | "guarantor";

const ETAPAS: { id: Paso; txt: string; soloEstudiante?: boolean }[] = [
  { id: "cuenta", txt: "Cuenta" },
  { id: "email", txt: "Email" },
  { id: "rol", txt: "Rol" },
  { id: "universidad", txt: "Universidad", soloEstudiante: true },
  { id: "identidad", txt: "Identidad" },
  { id: "wallet", txt: "Wallet" },
  { id: "fondeo", txt: "Fondeo" },
];

async function api(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Ocurrió un error");
  return data;
}

export default function RegistroWizard() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("cuenta");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("student");
  const [cargandoInicial, setCargandoInicial] = useState(true);

  // Si ya hay sesión, retomamos en el paso pendiente.
  useEffect(() => {
    (async () => {
      try {
        const { user } = await api("/api/auth/me", undefined, "GET");
        if (user) {
          setRol(user.role === "guarantor" ? "guarantor" : "student");
          if (user.pasoPendiente) setPaso(user.pasoPendiente);
          else router.replace("/panel");
        }
      } catch {
        /* sin sesión: empezamos desde el inicio */
      } finally {
        setCargandoInicial(false);
      }
    })();
  }, [router]);

  if (cargandoInicial) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        <Spinner className="h-6 w-6 text-teal-500" />
      </div>
    );
  }

  const etapas = ETAPAS.filter((e) => !e.soloEstudiante || rol === "student");

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/60 to-white px-4 py-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="inline-block">
          <Logo />
        </Link>

        <Stepper etapas={etapas} paso={paso} />

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {paso === "cuenta" && (
            <PasoCuenta
              onNext={(e) => {
                setEmail(e);
                setPaso("email");
              }}
            />
          )}
          {paso === "email" && <PasoEmail email={email} onNext={() => setPaso("rol")} />}
          {paso === "rol" && (
            <PasoRol
              onNext={(r) => {
                setRol(r);
                setPaso(r === "student" ? "universidad" : "identidad");
              }}
            />
          )}
          {paso === "universidad" && <PasoUniversidad onNext={() => setPaso("identidad")} />}
          {paso === "identidad" && <PasoKyc onNext={() => setPaso("wallet")} />}
          {paso === "wallet" && <PasoWallet onNext={() => setPaso("fondeo")} />}
          {paso === "fondeo" && <PasoFondeo onDone={() => router.replace("/panel")} />}
        </div>
      </div>
    </div>
  );
}

function Stepper({ etapas, paso }: { etapas: typeof ETAPAS; paso: Paso }) {
  const actual = etapas.findIndex((e) => e.id === paso);
  return (
    <div className="mt-6 flex items-center gap-2">
      {etapas.map((e, i) => (
        <div key={e.id} className="flex flex-1 flex-col items-center gap-1.5">
          <div className={`h-1.5 w-full rounded-full ${i <= actual ? "bg-teal-500" : "bg-slate-200"}`} />
          <span className={`text-[11px] font-medium ${i <= actual ? "text-teal-700" : "text-slate-400"}`}>
            {e.txt}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------- Cuenta -------------------- */
function PasoCuenta({ onNext }: { onNext: (email: string) => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const d = await api("/api/auth/register", form);
      onNext(d.email);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Crea tu cuenta</h1>
      <p className="text-sm text-slate-500">Te enviaremos un código a tu email para verificarlo.</p>

      <Campo label="Nombre completo" htmlFor="fullName">
        <input id="fullName" className={inputClase} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required />
      </Campo>
      <Campo label="Email" htmlFor="email">
        <input id="email" type="email" className={inputClase} value={form.email} onChange={(e) => set("email", e.target.value)} required />
      </Campo>
      <Campo label="Contraseña" htmlFor="password" hint="Mínimo 8 caracteres">
        <input id="password" type="password" className={inputClase} value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
      </Campo>

      {error && <Alerta tipo="error">{error}</Alerta>}

      <Boton type="submit" disabled={cargando} className="w-full">
        {cargando && <Spinner />} Crear cuenta
      </Boton>
      <p className="text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/ingresar" className="font-semibold text-teal-600">
          Ingresar
        </Link>
      </p>
    </form>
  );
}

/* -------------------- Código por email -------------------- */
function PasoEmail({ email, onNext }: { email: string; onNext: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await api("/api/auth/verify-email", { email, code });
      onNext();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function reenviar() {
    setError("");
    setAviso("");
    try {
      await api("/api/auth/verify-email", { email, resend: true });
      setAviso("Te enviamos un código nuevo.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={verificar} className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Verifica tu email</h1>
      <p className="text-sm text-slate-500">
        Ingresa el código que enviamos a <strong className="text-slate-700">{email}</strong>.
      </p>

      <Campo label="Código de verificación" htmlFor="code">
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          className={`${inputClase} text-center text-2xl tracking-[0.5em]`}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="••••••"
          required
        />
      </Campo>

      {error && <Alerta tipo="error">{error}</Alerta>}
      {aviso && <Alerta tipo="success">{aviso}</Alerta>}

      <Boton type="submit" disabled={cargando} className="w-full">
        {cargando && <Spinner />} Verificar
      </Boton>
      <button type="button" onClick={reenviar} className="w-full text-center text-sm font-semibold text-teal-600">
        Reenviar código
      </button>
    </form>
  );
}

/* -------------------- Rol -------------------- */
function PasoRol({ onNext }: { onNext: (r: Rol) => void }) {
  const [role, setRole] = useState<Rol | "">("");
  const [invitationCode, setInvitationCode] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function continuar() {
    if (!role) return setError("Elige un rol");
    setError("");
    setCargando(true);
    try {
      await api("/api/auth/role", { role, invitationCode: invitationCode || undefined });
      onNext(role);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">¿Cómo participas?</h1>
      <div className="grid gap-3">
        <RolCard activo={role === "student"} onClick={() => setRole("student")} titulo="Estudiante" desc="Pido mi primer crédito, respaldado por un ahorro en USDC." />
        <RolCard activo={role === "guarantor"} onClick={() => setRole("guarantor")} titulo="Garante" desc="Respaldo a un estudiante bloqueando USDC como garantía." />
      </div>

      {role === "guarantor" && (
        <Campo label="Código de invitación (opcional)" htmlFor="inv" hint="Te lo comparte el estudiante. También puedes vincularte después.">
          <input id="inv" className={`${inputClase} font-mono`} value={invitationCode} onChange={(e) => setInvitationCode(e.target.value.trim())} />
        </Campo>
      )}

      {error && <Alerta tipo="error">{error}</Alerta>}

      <Boton onClick={continuar} disabled={cargando} className="w-full">
        {cargando && <Spinner />} Continuar
      </Boton>
    </div>
  );
}

function RolCard({ activo, onClick, titulo, desc }: { activo: boolean; onClick: () => void; titulo: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        activo ? "border-teal-500 bg-teal-50 ring-2 ring-teal-100" : "border-slate-200 hover:border-teal-300"
      }`}
    >
      <p className="font-semibold text-slate-900">{titulo}</p>
      <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
    </button>
  );
}

/* -------------------- Datos universitarios -------------------- */
function PasoUniversidad({ onNext }: { onNext: () => void }) {
  const [form, setForm] = useState({ universityName: "", career: "", studentCode: "", semester: "1" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await api("/api/student-profile", form);
      onNext();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Tus datos universitarios</h1>
      <p className="text-sm text-slate-500">Nos ayudan a evaluar tu solicitud. No se guardan en la blockchain.</p>

      <Campo label="Universidad" htmlFor="uni">
        <input id="uni" className={inputClase} value={form.universityName} onChange={(e) => set("universityName", e.target.value)} placeholder="Ej. Universidad Mayor de San Andrés" required />
      </Campo>
      <Campo label="Carrera" htmlFor="career">
        <input id="career" className={inputClase} value={form.career} onChange={(e) => set("career", e.target.value)} required />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Código o matrícula (opcional)" htmlFor="code">
          <input id="code" className={inputClase} value={form.studentCode} onChange={(e) => set("studentCode", e.target.value)} />
        </Campo>
        <Campo label="Semestre" htmlFor="sem">
          <select id="sem" className={inputClase} value={form.semester} onChange={(e) => set("semester", e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}º semestre
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {error && <Alerta tipo="error">{error}</Alerta>}

      <Boton type="submit" disabled={cargando} className="w-full">
        {cargando && <Spinner />} Continuar
      </Boton>
    </form>
  );
}

/* -------------------- KYC (SEP-12) -------------------- */
function PasoKyc({ onNext }: { onNext: () => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", idNumber: "", birthDate: "" });
  const [carnet, setCarnet] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!carnet || !selfie) return setError("Sube la foto de tu carnet y una selfie");
    setError("");
    setCargando(true);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) fd.append(k, v);
      fd.append("carnet", carnet);
      fd.append("selfie", selfie);
      await api("/api/kyc", fd);
      onNext();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Verifica tu identidad</h1>
      <p className="text-sm text-slate-500">
        Tus documentos se guardan en un almacenamiento privado y los revisa un operador de PrimerPaso.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombres" htmlFor="fn">
          <input id="fn" className={inputClase} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
        </Campo>
        <Campo label="Apellidos" htmlFor="ln">
          <input id="ln" className={inputClase} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
        </Campo>
        <Campo label="Carnet de identidad" htmlFor="ci">
          <input id="ci" className={inputClase} value={form.idNumber} onChange={(e) => set("idNumber", e.target.value)} required />
        </Campo>
        <Campo label="Fecha de nacimiento" htmlFor="bd">
          <input id="bd" type="date" className={inputClase} value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} required />
        </Campo>
      </div>

      <SubidaArchivo label="Foto de tu carnet de identidad" archivo={carnet} onFile={setCarnet} />
      <SubidaArchivo label="Selfie sosteniendo tu carnet" archivo={selfie} onFile={setSelfie} />

      {error && <Alerta tipo="error">{error}</Alerta>}

      <Boton type="submit" disabled={cargando} className="w-full">
        {cargando && <Spinner />} Enviar verificación
      </Boton>
    </form>
  );
}

function SubidaArchivo({ label, archivo, onFile }: { label: string; archivo: File | null; onFile: (f: File) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!archivo || !archivo.type.startsWith("image/")) return setPreview(null);
    const url = URL.createObjectURL(archivo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  return (
    <Campo label={label}>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition hover:border-teal-300">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="vista previa" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-white text-slate-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        <span className="text-sm text-slate-500">
          {archivo ? `${archivo.name} ✓ (toca para cambiar)` : "Toca para subir (JPG, PNG o PDF, máx. 5 MB)"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>
    </Campo>
  );
}

/* -------------------- Wallet (SEP-10) -------------------- */
function PasoWallet({ onNext }: { onNext: () => void }) {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function conectar() {
    setError("");
    setCargando(true);
    try {
      const addr = await conectarFreighter();
      const { challenge } = await api(`/api/sep10/challenge?account=${addr}`, undefined, "GET");
      const signed = await firmarXdr(challenge, addr);
      const d = await api("/api/sep10/token", { signedXdr: signed });
      setAddress(d.address);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Conecta tu wallet</h1>
      <p className="text-sm text-slate-500">
        Vincula tu wallet Freighter y autentícala con SEP-10 (firmas un challenge, sin exponer tu llave).
      </p>

      {address ? (
        <>
          <Alerta tipo="success">
            Wallet vinculada: <span className="font-mono">{address.slice(0, 6)}…{address.slice(-6)}</span>
          </Alerta>
          <Boton onClick={onNext} className="w-full">
            Continuar
          </Boton>
        </>
      ) : (
        <>
          {error && <Alerta tipo="error">{error}</Alerta>}
          <Boton onClick={conectar} disabled={cargando} className="w-full">
            {cargando && <Spinner />} Conectar con Freighter
          </Boton>
          <p className="text-center text-xs text-slate-400">
            ¿No tienes Freighter?{" "}
            <a href="https://www.freighter.app/" target="_blank" rel="noreferrer" className="text-teal-600">
              Instálalo aquí
            </a>{" "}
            y elige la red Testnet.
          </p>
        </>
      )}
    </div>
  );
}

/* -------------------- Fondeo en Testnet -------------------- */
type EstadoFondeo = "pendiente" | "haciendo" | "ok" | "error";

function PasoFondeo({ onDone }: { onDone: () => void }) {
  const [xlm, setXlm] = useState<EstadoFondeo>("pendiente");
  const [trust, setTrust] = useState<EstadoFondeo>("pendiente");
  const [usdc, setUsdc] = useState<EstadoFondeo>("pendiente");
  const [error, setError] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    api("/api/auth/me", undefined, "GET").then(({ user }) => user?.wallet && setAddress(user.wallet));
  }, []);

  async function fondear() {
    setError("");
    try {
      setXlm("haciendo");
      await api("/api/faucet", { action: "airdrop" });
      setXlm("ok");

      setTrust("haciendo");
      const t = await api("/api/faucet", { action: "trustline" });
      if (!t.yaExiste && t.xdr) {
        const signed = await firmarXdr(t.xdr, address);
        await api("/api/faucet", { action: "submit", xdr: signed });
      }
      setTrust("ok");

      setUsdc("haciendo");
      await api("/api/faucet", { action: "usdc" });
      setUsdc("ok");
    } catch (err) {
      setError((err as Error).message);
      setXlm((s) => (s === "haciendo" ? "error" : s));
      setTrust((s) => (s === "haciendo" ? "error" : s));
      setUsdc((s) => (s === "haciendo" ? "error" : s));
    }
  }

  const ocupado = [xlm, trust, usdc].includes("haciendo");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Fondea tu cuenta</h1>
      <p className="text-sm text-slate-500">
        En Testnet, con dinero de prueba: crea tu cuenta en la red, agrega el USDC de prueba y te entrega 1.500 USDC.
      </p>

      <ul className="space-y-2">
        <ItemFondeo estado={xlm} texto="Fondear XLM (Friendbot)" />
        <ItemFondeo estado={trust} texto="Crear trustline al USDC" />
        <ItemFondeo estado={usdc} texto="Recibir 1.500 USDC de prueba" />
      </ul>

      {error && <Alerta tipo="error">{error}</Alerta>}

      <div className="flex gap-2">
        <Boton onClick={fondear} variant="secondary" className="flex-1" disabled={ocupado || !address}>
          {ocupado && <Spinner />} {xlm === "pendiente" ? "Fondear ahora" : "Reintentar"}
        </Boton>
        <Boton onClick={onDone} className="flex-1">
          Ir a mi panel
        </Boton>
      </div>
    </div>
  );
}

function ItemFondeo({ estado, texto }: { estado: EstadoFondeo; texto: string }) {
  const iconos = {
    pendiente: <span className="h-4 w-4 rounded-full border border-slate-300" />,
    haciendo: <Spinner className="h-4 w-4 text-teal-500" />,
    ok: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-emerald-500">
        <path d="M5 12l5 5 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    error: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-amber-500">
        <path d="M12 8v5m0 3h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  };
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
      {iconos[estado]}
      {texto}
    </li>
  );
}
