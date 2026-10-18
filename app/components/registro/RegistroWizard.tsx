"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { Campo, inputClase, Boton, Alerta, Spinner } from "@/components/ui";
import { conectarFreighter, firmarXdr } from "@/lib/wallet";

type Paso = 0 | 1 | 2 | 3 | 4 | 5;
const ETAPAS = ["Datos", "Email", "Rol", "Identidad", "Wallet", "Fondeo"];

async function api(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Ocurrió un error");
  return data;
}

export default function RegistroWizard() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>(0);
  const [cargandoInicial, setCargandoInicial] = useState(true);

  // Al montar, reanudamos en el paso correcto según el estado del usuario.
  useEffect(() => {
    (async () => {
      try {
        const { user } = await api("/api/auth/me", undefined, "GET");
        if (user) {
          if (!user.emailVerified) setPaso(1);
          else if (!user.role) setPaso(2);
          else if (!user.kycStatus) setPaso(3);
          else if (!user.walletAddress) setPaso(4);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/60 to-white px-4 py-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="inline-block">
          <Logo />
        </Link>

        <Stepper paso={paso} />

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {paso === 0 && <PasoDatos onNext={() => setPaso(1)} />}
          {paso === 1 && <PasoEmail onNext={() => setPaso(2)} />}
          {paso === 2 && <PasoRol onNext={() => setPaso(3)} />}
          {paso === 3 && <PasoKyc onNext={() => setPaso(4)} />}
          {paso === 4 && <PasoWallet onNext={() => setPaso(5)} />}
          {paso === 5 && <PasoFondeo onDone={() => router.replace("/panel")} />}
        </div>
      </div>
    </div>
  );
}

function Stepper({ paso }: { paso: Paso }) {
  return (
    <div className="mt-6 flex items-center gap-2">
      {ETAPAS.map((e, i) => (
        <div key={e} className="flex flex-1 flex-col items-center gap-1.5">
          <div
            className={`h-1.5 w-full rounded-full ${
              i <= paso ? "bg-teal-500" : "bg-slate-200"
            }`}
          />
          <span
            className={`text-[11px] font-medium ${
              i <= paso ? "text-teal-700" : "text-slate-400"
            }`}
          >
            {e}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------- Paso 1: Datos de la cuenta -------------------- */
function PasoDatos({ onNext }: { onNext: () => void }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    idCard: "",
    university: "",
    career: "",
    studyYear: "1",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await api("/api/auth/register", form);
      onNext();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Crea tu cuenta</h1>
      <p className="text-sm text-slate-500">Todos los campos son obligatorios.</p>

      <Campo label="Nombre completo" htmlFor="fullName">
        <input
          id="fullName"
          className={inputClase}
          value={form.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          required
        />
      </Campo>

      <Campo label="Email" htmlFor="email">
        <input
          id="email"
          type="email"
          className={inputClase}
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          required
        />
      </Campo>

      <Campo label="Contraseña" htmlFor="password" hint="Mínimo 8 caracteres">
        <input
          id="password"
          type="password"
          className={inputClase}
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          required
        />
      </Campo>

      <Campo label="Carnet de identidad" htmlFor="idCard">
        <input
          id="idCard"
          className={inputClase}
          value={form.idCard}
          onChange={(e) => set("idCard", e.target.value)}
          required
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Universidad" htmlFor="university">
          <input
            id="university"
            className={inputClase}
            value={form.university}
            onChange={(e) => set("university", e.target.value)}
            required
          />
        </Campo>
        <Campo label="Carrera" htmlFor="career">
          <input
            id="career"
            className={inputClase}
            value={form.career}
            onChange={(e) => set("career", e.target.value)}
            required
          />
        </Campo>
      </div>

      <Campo label="Año de estudio" htmlFor="studyYear">
        <select
          id="studyYear"
          className={inputClase}
          value={form.studyYear}
          onChange={(e) => set("studyYear", e.target.value)}
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}º año
            </option>
          ))}
        </select>
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

/* -------------------- Paso 2: Verificación de email -------------------- */
function PasoEmail({ onNext }: { onNext: () => void }) {
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  // Pedimos (reenviamos) un código al entrar para mostrarlo en modo demo.
  useEffect(() => {
    api("/api/auth/verify-email", { resend: true })
      .then((d) => d.devCode && setDevCode(d.devCode))
      .catch(() => {});
  }, []);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await api("/api/auth/verify-email", { code });
      onNext();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={verificar} className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Verifica tu email</h1>
      <p className="text-sm text-slate-500">
        Ingresa el código de 6 dígitos que enviamos a tu correo.
      </p>

      {devCode && (
        <Alerta tipo="info">
          Modo demo: tu código es <strong>{devCode}</strong>
        </Alerta>
      )}

      <Campo label="Código de verificación" htmlFor="code">
        <input
          id="code"
          inputMode="numeric"
          maxLength={6}
          className={`${inputClase} text-center text-2xl tracking-[0.5em]`}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="______"
          required
        />
      </Campo>

      {error && <Alerta tipo="error">{error}</Alerta>}

      <Boton type="submit" disabled={cargando} className="w-full">
        {cargando && <Spinner />} Verificar
      </Boton>
    </form>
  );
}

/* -------------------- Paso 3: Elegir rol -------------------- */
function PasoRol({ onNext }: { onNext: () => void }) {
  const [role, setRole] = useState<"ESTUDIANTE" | "GARANTE" | "">("");
  const [invitationCode, setInvitationCode] = useState("");
  const [codigoGenerado, setCodigoGenerado] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function continuar() {
    if (!role) return setError("Elige un rol");
    setError("");
    setCargando(true);
    try {
      const d = await api("/api/auth/role", { role, invitationCode });
      if (role === "ESTUDIANTE" && d.invitationCode) {
        setCodigoGenerado(d.invitationCode);
      } else {
        onNext();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  if (codigoGenerado) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-slate-900">¡Listo, estudiante!</h1>
        <p className="text-sm text-slate-500">
          Comparte este código con tu familiar garante para que respalde tu
          crédito (opcional, puedes hacerlo luego desde tu panel):
        </p>
        <div className="rounded-xl border border-dashed border-teal-300 bg-teal-50 px-4 py-4 text-center">
          <span className="font-mono text-2xl font-bold tracking-wider text-teal-700">
            {codigoGenerado}
          </span>
        </div>
        <Boton onClick={onNext} className="w-full">
          Continuar
        </Boton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">¿Cómo participas?</h1>
      <div className="grid gap-3">
        <RolCard
          activo={role === "ESTUDIANTE"}
          onClick={() => setRole("ESTUDIANTE")}
          titulo="Estudiante"
          desc="Pido un crédito respaldado por mi ahorro."
        />
        <RolCard
          activo={role === "GARANTE"}
          onClick={() => setRole("GARANTE")}
          titulo="Garante"
          desc="Respaldo a un estudiante con mi ahorro."
        />
      </div>

      {role === "GARANTE" && (
        <Campo
          label="Código de invitación (opcional)"
          htmlFor="inv"
          hint="Te lo comparte el estudiante. Puedes vincularte ahora o más tarde."
        >
          <input
            id="inv"
            className={`${inputClase} font-mono uppercase`}
            value={invitationCode}
            onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
            placeholder="PP-XXXXXX"
          />
        </Campo>
      )}

      {error && <Alerta tipo="error">{error}</Alerta>}

      <Boton onClick={continuar} disabled={cargando} className="w-full">
        {cargando && <Spinner />} Continuar
      </Boton>
    </div>
  );
}

function RolCard({
  activo,
  onClick,
  titulo,
  desc,
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        activo
          ? "border-teal-500 bg-teal-50 ring-2 ring-teal-100"
          : "border-slate-200 hover:border-teal-300"
      }`}
    >
      <p className="font-semibold text-slate-900">{titulo}</p>
      <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
    </button>
  );
}

/* -------------------- Paso 4: KYC (SEP-12 simulado) -------------------- */
function PasoKyc({ onNext }: { onNext: () => void }) {
  const [idDoc, setIdDoc] = useState("");
  const [selfie, setSelfie] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function leerArchivo(file: File, set: (v: string) => void) {
    const reader = new FileReader();
    reader.onload = () => set(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function enviar() {
    if (!idDoc || !selfie) return setError("Sube ambas imágenes");
    setError("");
    setCargando(true);
    try {
      await api("/api/kyc", { idDoc, selfie });
      onNext();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Verifica tu identidad</h1>
      <p className="text-sm text-slate-500">
        Siguiendo la estructura SEP-12. En esta demo se aprueba al instante.
      </p>

      <SubidaArchivo
        label="Foto de tu carnet de identidad"
        valor={idDoc}
        onFile={(f) => leerArchivo(f, setIdDoc)}
      />
      <SubidaArchivo
        label="Selfie"
        valor={selfie}
        onFile={(f) => leerArchivo(f, setSelfie)}
      />

      {error && <Alerta tipo="error">{error}</Alerta>}

      <Boton onClick={enviar} disabled={cargando} className="w-full">
        {cargando && <Spinner />} Enviar verificación
      </Boton>
    </div>
  );
}

function SubidaArchivo({
  label,
  valor,
  onFile,
}: {
  label: string;
  valor: string;
  onFile: (f: File) => void;
}) {
  return (
    <Campo label={label}>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition hover:border-teal-300">
        {valor ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={valor}
            alt="vista previa"
            className="h-12 w-12 rounded-lg object-cover"
          />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-white text-slate-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
        <span className="text-sm text-slate-500">
          {valor ? "Imagen cargada ✓ (toca para cambiar)" : "Toca para subir"}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>
    </Campo>
  );
}

/* -------------------- Paso 5: Conectar wallet (SEP-10) -------------------- */
function PasoWallet({ onNext }: { onNext: () => void }) {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function conectar() {
    setError("");
    setCargando(true);
    try {
      // 1. Conecta Freighter y obtiene la dirección.
      const addr = await conectarFreighter();
      // 2. Pide el challenge SEP-10.
      const { challenge } = await api(
        `/api/sep10/challenge?account=${addr}`,
        undefined,
        "GET",
      );
      // 3. Firma el challenge con la wallet.
      const signed = await firmarXdr(challenge, addr);
      // 4. El servidor verifica y vincula la wallet.
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
        Vincula tu wallet Freighter y autentícala con SEP-10 (firmas un
        challenge, sin exponer tu llave).
      </p>

      {address ? (
        <>
          <Alerta tipo="success">
            Wallet vinculada:{" "}
            <span className="font-mono">
              {address.slice(0, 6)}…{address.slice(-6)}
            </span>
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
            <a
              href="https://www.freighter.app/"
              target="_blank"
              rel="noreferrer"
              className="text-teal-600"
            >
              Instálalo aquí
            </a>
          </p>
        </>
      )}
    </div>
  );
}

/* -------------------- Paso 6: Fondeo en Testnet -------------------- */
type EstadoFondeo = "pendiente" | "haciendo" | "ok" | "error";

function PasoFondeo({ onDone }: { onDone: () => void }) {
  const [xlm, setXlm] = useState<EstadoFondeo>("pendiente");
  const [trust, setTrust] = useState<EstadoFondeo>("pendiente");
  const [usdc, setUsdc] = useState<EstadoFondeo>("pendiente");
  const [error, setError] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    api("/api/auth/me", undefined, "GET").then(({ user }) => {
      if (user?.walletAddress) setAddress(user.walletAddress);
    });
  }, []);

  async function fondear() {
    setError("");
    try {
      // 1. XLM con Friendbot.
      setXlm("haciendo");
      await api("/api/faucet", { action: "airdrop" });
      setXlm("ok");

      // 2. Trustline al USDC (firmada con la wallet).
      setTrust("haciendo");
      const t = await api("/api/faucet", { action: "trustline" });
      if (!t.yaExiste && t.xdr) {
        const signed = await firmarXdr(t.xdr, address);
        await api("/api/faucet", { action: "submit", xdr: signed });
      }
      setTrust("ok");

      // 3. USDC de prueba (lo envía el emisor).
      setUsdc("haciendo");
      const u = await api("/api/faucet", { action: "usdc" }).catch(
        (e) => ({ error: (e as Error).message }),
      );
      if ((u as { error?: string }).error) {
        // Sin emisor configurado: no es bloqueante para el MVP.
        setUsdc("error");
        setError(
          "XLM y trustline listos. El USDC automático no está disponible (configura STELLAR_ISSUER_SECRET). Puedes continuar igual.",
        );
      } else {
        setUsdc("ok");
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Fondea tu cuenta</h1>
      <p className="text-sm text-slate-500">
        En Testnet, con dinero de prueba. Esto crea tu cuenta en la red, agrega
        el USDC de prueba y te entrega saldo inicial.
      </p>

      <ul className="space-y-2">
        <ItemFondeo estado={xlm} texto="Fondear XLM (Friendbot)" />
        <ItemFondeo estado={trust} texto="Crear trustline al USDC" />
        <ItemFondeo estado={usdc} texto="Recibir USDC de prueba" />
      </ul>

      {error && <Alerta tipo="info">{error}</Alerta>}

      <div className="flex gap-2">
        <Boton
          onClick={fondear}
          variant="secondary"
          className="flex-1"
          disabled={xlm === "haciendo" || trust === "haciendo"}
        >
          {xlm === "pendiente" ? "Fondear ahora" : "Reintentar"}
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
