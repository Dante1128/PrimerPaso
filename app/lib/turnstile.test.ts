import { afterEach, describe, expect, it, vi } from "vitest";
import { verificarCaptcha } from "@/lib/turnstile";

const respuesta = (success: boolean) => vi.fn(async () => new Response(JSON.stringify({ success })));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CAPTCHA con Turnstile", () => {
  it("sin claves (testnet) no se exige y no llama a Cloudflare", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const f = respuesta(false);
    vi.stubGlobal("fetch", f);
    expect(await verificarCaptcha(undefined)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("con claves exige el token", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secreto");
    expect(await verificarCaptcha("")).toMatch(/verificación de seguridad/);
  });

  it("acepta un token válido y manda la IP a Cloudflare", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secreto");
    const f = respuesta(true);
    vi.stubGlobal("fetch", f);
    expect(await verificarCaptcha("tok", "1.2.3.4")).toBeNull();
    const cuerpo = (f.mock.calls[0] as unknown as [string, { body: URLSearchParams }])[1].body;
    expect(Object.fromEntries(cuerpo)).toEqual({ secret: "secreto", response: "tok", remoteip: "1.2.3.4" });
  });

  it("rechaza un token inválido o si Cloudflare no responde", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secreto");
    vi.stubGlobal("fetch", respuesta(false));
    expect(await verificarCaptcha("malo")).toMatch(/falló/);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("red"))));
    expect(await verificarCaptcha("tok")).toMatch(/No pudimos validar/);
  });
});
