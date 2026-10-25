import { describe, expect, it } from "vitest";
import { evaluarSesionStaff, leerSesionDelToken } from "@/lib/politica-staff";

const AHORA = 1_800_000_000;
const hace = (horas: number) => AHORA - horas * 3600;
const evaluar = (o: Partial<Parameters<typeof evaluarSesionStaff>[0]>) =>
  evaluarSesionStaff({
    esStaff: true,
    sesion: { aal: "aal1", metodos: [{ method: "password", timestamp: hace(1) }] },
    exigirMfa: false,
    ahora: AHORA,
    ...o,
  });

describe("política de sesión del staff", () => {
  it("estudiantes y garantes no tienen reglas extra", () => {
    expect(evaluar({ esStaff: false, sesion: { aal: "aal1", metodos: [{ method: "oauth", timestamp: hace(48) }] } })).toEqual({ ok: true });
  });

  it("con MFA apagado (testnet) el staff entra con contraseña como hoy", () => {
    expect(evaluar({})).toEqual({ ok: true });
  });

  it("con MFA obligatorio exige aal2", () => {
    expect(evaluar({ exigirMfa: true })).toMatchObject({ ok: false, codigo: "MFA_REQUERIDO" });
    const conTotp = { aal: "aal2", metodos: [{ method: "password", timestamp: hace(1) }, { method: "totp", timestamp: hace(0.5) }] };
    expect(evaluar({ exigirMfa: true, sesion: conTotp })).toEqual({ ok: true });
  });

  it("la sesión del staff dura como máximo 12 horas desde el ingreso", () => {
    expect(evaluar({ sesion: { aal: "aal1", metodos: [{ method: "password", timestamp: hace(11.9) }] } })).toEqual({ ok: true });
    // Verificar el TOTP más tarde no reinicia el reloj.
    const vieja = { aal: "aal2", metodos: [{ method: "password", timestamp: hace(13) }, { method: "totp", timestamp: hace(1) }] };
    expect(evaluar({ sesion: vieja })).toMatchObject({ ok: false, codigo: "SESION_VENCIDA" });
  });

  it("el staff nunca entra con Google", () => {
    expect(evaluar({ sesion: { aal: "aal1", metodos: [{ method: "oauth", timestamp: hace(1) }] } })).toMatchObject({
      ok: false,
      codigo: "STAFF_SIN_GOOGLE",
    });
  });
});

describe("leerSesionDelToken", () => {
  it("lee aal y amr del JWT", () => {
    const payload = Buffer.from(JSON.stringify({ aal: "aal2", amr: [{ method: "totp", timestamp: 5 }] })).toString("base64url");
    expect(leerSesionDelToken(`x.${payload}.y`)).toEqual({ aal: "aal2", metodos: [{ method: "totp", timestamp: 5 }] });
  });

  it("un token ilegible no tiene métodos ni aal", () => {
    expect(leerSesionDelToken("basura")).toEqual({ aal: null, metodos: [] });
    expect(leerSesionDelToken(undefined)).toEqual({ aal: null, metodos: [] });
  });
});
