"use client";
// MFA del staff con Supabase (TOTP). La primera vez muestra el QR para
// Google Authenticator, Authy, etc.; después solo pide el código de 6 dígitos.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";
import { Alerta, Boton, Campo, Spinner, inputClase } from "@/components/ui";
import { Tarjeta } from "@/components/panel/comunes";

type Estado =
  | { fase: "cargando" }
  | { fase: "inscribir"; factorId: string; qr: string; secreto: string }
  | { fase: "verificar"; factorId: string }
  | { fase: "error"; mensaje: string };

/** Busca un TOTP verificado; si no hay, crea uno nuevo (descarta los a medias). */
async function preparar(): Promise<Estado> {
  const mfa = supabaseNavegador().auth.mfa;
  const { data, error } = await mfa.listFactors();
  if (error) return { fase: "error", mensaje: "No se pudo leer tu MFA. Vuelve a ingresar." };
  const verificado = data.totp.find((f) => f.status === "verified");
  if (verificado) return { fase: "verificar", factorId: verificado.id };

  for (const f of data.all.filter((f) => f.factor_type === "totp" && f.status === "unverified")) {
    await mfa.unenroll({ factorId: f.id });
  }
  const nombre = "PrimerPaso " + new Date().toISOString().slice(0, 16);
  const nuevo = await mfa.enroll({ factorType: "totp", friendlyName: nombre });
  if (nuevo.error) return { fase: "error", mensaje: "No se pudo iniciar el MFA. Revisa que TOTP esté habilitado en Supabase." };
  return { fase: "inscribir", factorId: nuevo.data.id, qr: nuevo.data.totp.qr_code, secreto: nuevo.data.totp.secret };
}

export function VerificacionMfa({ obligatoria }: { obligatoria: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    preparar().then(setEstado);
  }, []);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    if (estado.fase !== "inscribir" && estado.fase !== "verificar") return;
    setError("");
    setVerificando(true);
    const { error } = await supabaseNavegador().auth.mfa.challengeAndVerify({ factorId: estado.factorId, code: codigo });
    setVerificando(false);
    if (error) {
      setError("Código incorrecto o vencido. Usa el código actual de tu app.");
      return;
    }
    setListo(true);
    router.refresh();
  }

  return (
    <Tarjeta titulo={obligatoria ? "Verificación en dos pasos" : "Activar MFA"}>
      {estado.fase === "cargando" && <Spinner className="h-5 w-5" />}
      {estado.fase === "error" && <Alerta tipo="error">{estado.mensaje}</Alerta>}
      {listo && <Alerta tipo="success">MFA verificado en esta sesión.</Alerta>}
      {!listo && (estado.fase === "inscribir" || estado.fase === "verificar") && (
        <form onSubmit={verificar} className="space-y-4">
          {estado.fase === "inscribir" ? (
            <>
              <p className="text-sm text-ink/70">
                {obligatoria ? "Tu cuenta de equipo necesita MFA. " : ""}
                Escanea este QR con Google Authenticator, Authy o similar y escribe el código que aparece.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={estado.qr} alt="QR para tu app de autenticación" className="h-44 w-44 rounded-xl border-2 border-ink bg-white p-2" />
              <p className="text-xs text-ink/60">
                ¿No puedes escanear? Clave: <code className="break-all font-mono">{estado.secreto}</code>
              </p>
            </>
          ) : (
            <p className="text-sm text-ink/70">Escribe el código de 6 dígitos de tu app de autenticación.</p>
          )}
          <Campo label="Código" htmlFor="mfa">
            <input
              id="mfa"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={`${inputClase} text-center text-2xl tracking-[0.5em]`}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              required
            />
          </Campo>
          {error && <Alerta tipo="error">{error}</Alerta>}
          <Boton type="submit" disabled={verificando || codigo.length !== 6}>
            {verificando && <Spinner />} Verificar
          </Boton>
        </form>
      )}
    </Tarjeta>
  );
}

/** Aviso para el staff cuando el MFA no es obligatorio (testnet). */
export function AvisoMfaTestnet({ configurado, verificadoAhora }: { configurado: boolean; verificadoAhora: boolean }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="mb-6 space-y-4">
      <Alerta tipo="info">
        <span className="font-bold">MFA desactivado (solo testnet).</span>{" "}
        {verificadoAhora
          ? "Igual verificaste tu código en esta sesión."
          : configurado
            ? "Tu cuenta tiene MFA; puedes verificarlo de forma opcional."
            : "En producción el equipo debe usar MFA; aquí puedes activarlo de forma opcional."}{" "}
        {!verificadoAhora && !abierto && (
          <button type="button" onClick={() => setAbierto(true)} className="font-semibold underline">
            {configurado ? "Verificar ahora" : "Activar MFA"}
          </button>
        )}
      </Alerta>
      {abierto && <VerificacionMfa obligatoria={false} />}
    </div>
  );
}
