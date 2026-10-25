// Reglas de sesión para el staff (operator y admin). Función pura: la usan
// exigirUsuario (API) y el panel, y se prueba sin red.
//  - Nunca por Google: el staff entra con contraseña o código.
//  - Sesión de máximo 12 horas desde que ingresó.
//  - MFA (aal2) obligatorio si REQUIRE_STAFF_MFA=true.

export const HORAS_SESION_STAFF = 12;

export type MetodoAuth = { method: string; timestamp: number };
export type SesionAuth = { aal: string | null; metodos: MetodoAuth[] };

export type CodigoStaff = "STAFF_SIN_GOOGLE" | "SESION_VENCIDA" | "MFA_REQUERIDO";
export type EvaluacionStaff = { ok: true } | { ok: false; codigo: CodigoStaff; mensaje: string };

export const exigeMfaStaff = () => process.env.REQUIRE_STAFF_MFA === "true";

export function evaluarSesionStaff(p: {
  esStaff: boolean;
  sesion: SesionAuth;
  exigirMfa: boolean;
  /** Ahora, en segundos Unix. */
  ahora: number;
}): EvaluacionStaff {
  if (!p.esStaff) return { ok: true };
  const { metodos, aal } = p.sesion;

  if (metodos.some((m) => m.method === "oauth")) {
    return { ok: false, codigo: "STAFF_SIN_GOOGLE", mensaje: "Las cuentas del equipo no ingresan con Google." };
  }
  // El ingreso más antiguo de la sesión marca su inicio (el TOTP se agrega después).
  const inicio = metodos.length ? Math.min(...metodos.map((m) => m.timestamp)) : p.ahora;
  if (p.ahora - inicio > HORAS_SESION_STAFF * 3600) {
    return { ok: false, codigo: "SESION_VENCIDA", mensaje: "Tu sesión de equipo venció (máximo 12 horas). Vuelve a ingresar." };
  }
  if (p.exigirMfa && aal !== "aal2") {
    return { ok: false, codigo: "MFA_REQUERIDO", mensaje: "Verifica tu código de autenticación (MFA) para continuar." };
  }
  return { ok: true };
}

/** aal y métodos de ingreso del access token (ya validado con getUser). */
export function leerSesionDelToken(accessToken: string | undefined): SesionAuth {
  try {
    const payload = JSON.parse(Buffer.from(accessToken!.split(".")[1], "base64url").toString("utf8"));
    return { aal: payload.aal ?? null, metodos: Array.isArray(payload.amr) ? payload.amr : [] };
  } catch {
    return { aal: null, metodos: [] };
  }
}
