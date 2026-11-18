"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePollar } from "@pollar/react";
import Logo from "@/components/Logo";
import { Campo, inputClase, Boton, Alerta, Spinner } from "@/components/ui";
import { ES_TESTNET, fondearPrueba, type PasoFondeo as PasoDelFondeo } from "@/lib/cliente";

type Paso = "cuenta" | "rol" | "universidad" | "identidad" | "fondeo";
type Rol = "student" | "guarantor";

const ETAPAS: { id: Paso; txt: string; soloEstudiante?: boolean }[] = [
  { id: "cuenta", txt: "Entrar" },
  { id: "rol", txt: "Rol" },
  { id: "universidad", txt: "Universidad", soloEstudiante: true },
  { id: "identidad", txt: "Identidad" },
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
      <div className="grid min-h-screen place-items-center text-ink/50">
        <Spinner className="h-6 w-6 text-ink/40" />
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

        <div className="mt-6 rounded-3xl bg-white p-6 nb-shadow sm:p-8">
          {paso === "cuenta" && <PasoCuenta onNext={() => setPaso("rol")} />}
          {paso === "rol" && (
            <PasoRol
              onNext={(r) => {
                setRol(r);
                setPaso(r === "student" ? "universidad" : "identidad");
              }}
            />
          )}
          {paso === "universidad" && <PasoUniversidad onNext={() => setPaso("identidad")} />}
          {paso === "identidad" && <PasoKyc onNext={() => setPaso("fondeo")} />}
          {paso === "fondeo" && <PasoFondeo onDone={() => router.replace("/panel")} />}
        </div>
      </div>
    </div>
  );
}

function Stepper({ etapas, paso }: { etapas: typeof ETAPAS; paso: Paso }) {
  const actual = etapas.findIndex((e) => e.id === paso);
  return (
    <div className="mt-6">
      <p className="mb-2 text-sm text-ink/70 sm:hidden">Paso {actual + 1} de {etapas.length}: <strong>{etapas[actual]?.txt}</strong></p>
      <div className="flex items-start gap-2">
      {etapas.map((e, i) => (
        <div key={e.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className={`h-1.5 w-full rounded-full ${i <= actual ? "bg-brand" : "bg-ink/15"}`} />
          <span className={`hidden text-[11px] font-medium sm:block ${i <= actual ? "text-brandink" : "text-ink/50"}`}>
            {e.txt}
          </span>
        </div>
      ))}
      </div>
    </div>
  );
}

/* -------------------- Cuenta -------------------- */
/**
 * Login social con Pollar: crea la wallet automáticamente y, apenas está
 * lista, la vincula con un challenge SEP-10 (lo firma Pollar). Esa misma
 * verificación abre la sesión — es registro e ingreso a la vez, según si la
 * wallet ya existía.
 */
function PasoCuenta({ onNext }: { onNext: () => void }) {
  const { isAuthenticated, verified, wallet, hasWallet, createWallet, login, getClient } = usePollar();
  const [error, setError] = useState("");
  const vinculando = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !verified || vinculando.current) return;

    (async () => {
      try {
        let w = wallet;
        if (!w && !hasWallet) w = await createWallet();
        if (!w) return; // la wallet todavía se está creando

        vinculando.current = true;
        setError("");

        const { challenge, home_domain } = await api(`/api/sep10/challenge?account=${w.address}`, undefined, "GET");
        const firma = await getClient().stellar.sep10.sign({
          challengeXdr: challenge,
          homeDomains: home_domain,
          webAuthDomain: home_domain,
        });
        if (firma.status !== "signed") throw new Error("No se pudo firmar con tu wallet");

        const perfil = getClient().getUserProfile();
        const fullName = perfil ? `${perfil.first_name} ${perfil.last_name}`.trim() : undefined;
        await api("/api/sep10/token", { signedXdr: firma.signedXdr, fullName: fullName || undefined });
        onNext();
      } catch (err) {
        setError((err as Error).message);
        vinculando.current = false;
      }
    })();
  }, [isAuthenticated, verified, wallet, hasWallet, createWallet, getClient, onNext]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-ink">Entra a PrimerPaso</h1>
      <p className="text-sm text-ink/60">
        Inicia sesión con Google: te creamos una wallet automáticamente, sin instalar nada ni guardar contraseñas.
      </p>

      {isAuthenticated && (
        <p className="flex items-center gap-2 text-sm text-ink/70">
          <Spinner className="h-4 w-4" /> Preparando tu wallet…
        </p>
      )}

      {error && <Alerta tipo="error">{error}</Alerta>}

      {!isAuthenticated && (
        <Boton onClick={() => login({ provider: "google" })} className="w-full">
          Continuar con Google
        </Boton>
      )}
    </div>
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
      <h1 className="text-xl font-bold text-ink">¿Cómo participas?</h1>
      <p className="text-sm text-ink/60">Elige bien: el rol no se puede cambiar después.</p>
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
        activo ? "border-brand bg-brand/10 ring-2 ring-brand/20" : "border-line hover:border-ink/20"
      }`}
    >
      <p className="font-semibold text-ink">{titulo}</p>
      <p className="mt-0.5 text-sm text-ink/60">{desc}</p>
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
      <h1 className="text-xl font-bold text-ink">Tus datos universitarios</h1>
      <p className="text-sm text-ink/60">Nos ayudan a evaluar tu solicitud. Son privados: no se publican en la red.</p>

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
export function PasoKyc({ onNext, titulo = "Verifica tu identidad" }: { onNext: () => void; titulo?: string }) {
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
      <h1 className="text-xl font-bold text-ink">{titulo}</h1>
      <p className="text-sm text-ink/60">
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
  // La vista previa se crea al elegir el archivo y se libera al cambiarla.
  const [vista, setVista] = useState<{ de: File; url: string } | null>(null);
  const preview = vista && vista.de === archivo ? vista.url : null;
  useEffect(() => {
    if (vista) return () => URL.revokeObjectURL(vista.url);
  }, [vista]);

  function elegir(f: File) {
    setVista(f.type.startsWith("image/") ? { de: f, url: URL.createObjectURL(f) } : null);
    onFile(f);
  }

  return (
    <Campo label={label}>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-cream px-4 py-3 transition ">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="vista previa" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-white text-ink/50">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        <span className="text-sm text-ink/60">
          {archivo ? `${archivo.name} ✓ (toca para cambiar)` : "Toca para subir (JPG, PNG o PDF, máx. 5 MB)"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && elegir(e.target.files[0])}
        />
      </label>
    </Campo>
  );
}

/* -------------------- Fondeo en Testnet -------------------- */
type EstadoFondeo = "pendiente" | "haciendo" | "ok" | "error";

function PasoFondeo({ onDone }: { onDone: () => void }) {
  const { getClient } = usePollar();
  const [xlm, setXlm] = useState<EstadoFondeo>("pendiente");
  const [trust, setTrust] = useState<EstadoFondeo>("pendiente");
  const [usdc, setUsdc] = useState<EstadoFondeo>("pendiente");
  const [error, setError] = useState("");

  async function fondear() {
    setError("");
    const setters: Record<PasoDelFondeo, (e: EstadoFondeo) => void> = { xlm: setXlm, trust: setTrust, usdc: setUsdc };
    try {
      await fondearPrueba(getClient(), (paso, estado) => setters[paso](estado));
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
      <h1 className="text-xl font-bold text-ink">Consigue dinero de prueba</h1>
      <p className="text-sm text-ink/60">
        Estamos en una red de pruebas: este dinero no tiene valor real. Estos tres pasos dejan tu wallet lista para
        bloquear la garantía y pagar en USDC.
      </p>

      <ul className="space-y-2">
        <ItemFondeo estado={xlm} texto="Activar tu cuenta en la red" />
        <ItemFondeo estado={trust} texto="Habilitar USDC en tu wallet (te pedirá aprobar)" />
        <ItemFondeo estado={usdc} texto="Recibir 1.500 USDC de prueba" />
      </ul>

      {error && <Alerta tipo="error">{error}</Alerta>}

      <div className="flex gap-2">
        <Boton onClick={fondear} variant="secondary" className="flex-1" disabled={ocupado}>
          {ocupado && <Spinner />} {xlm === "pendiente" ? "Conseguir dinero de prueba" : "Reintentar"}
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
    pendiente: <span className="h-4 w-4 rounded-full border border-line" />,
    haciendo: <Spinner className="h-4 w-4 text-ink/50" />,
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
    <li className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink/80">
      {iconos[estado]}
      {texto}
    </li>
  );
}
