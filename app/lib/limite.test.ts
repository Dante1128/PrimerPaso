import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Contador en memoria en lugar de Postgres.
const intentos = new Map<string, number>();
const rpc = vi.fn(async (_f: string, a: { p_key: string; p_max: number }) => {
  const n = (intentos.get(a.p_key) ?? 0) + 1;
  intentos.set(a.p_key, n);
  return { data: n <= a.p_max, error: null };
});
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ rpc }) }));

const { limitarAuth, MENSAJE_LIMITE } = await import("@/lib/limite");
const peticion = (ip: string) => new Request("http://x/api/auth/login", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

beforeEach(() => {
  intentos.clear();
  rpc.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("límite de intentos en /api/auth", () => {
  it("deja pasar 10 intentos por minuto y frena el 11 con un mensaje claro", async () => {
    for (let i = 0; i < 10; i++) expect(await limitarAuth(peticion("1.1.1.1"), "login", "ana@x.co")).toBeNull();
    const r = await limitarAuth(peticion("1.1.1.1"), "login", "ana@x.co");
    expect(r?.status).toBe(429);
    expect(await r?.json()).toEqual({ error: MENSAJE_LIMITE });
  });

  it("cuenta por correo aunque cambie la IP", async () => {
    for (let i = 0; i < 10; i++) await limitarAuth(peticion(`2.2.2.${i}`), "login", "Ana@X.co");
    expect((await limitarAuth(peticion("3.3.3.3"), "login", "ana@x.co"))?.status).toBe(429);
  });

  it("otra persona en otra IP no se ve afectada", async () => {
    for (let i = 0; i < 11; i++) await limitarAuth(peticion("4.4.4.4"), "login", "a@x.co");
    expect(await limitarAuth(peticion("5.5.5.5"), "login", "b@x.co")).toBeNull();
  });

  it("se puede ajustar o apagar con variables de entorno", async () => {
    vi.stubEnv("AUTH_RATE_LIMIT_MAX", "2");
    await limitarAuth(peticion("6.6.6.6"), "code");
    await limitarAuth(peticion("6.6.6.6"), "code");
    expect((await limitarAuth(peticion("6.6.6.6"), "code"))?.status).toBe(429);
    vi.stubEnv("AUTH_RATE_LIMIT", "false");
    expect(await limitarAuth(peticion("6.6.6.6"), "code")).toBeNull();
  });

  it("si la base falla no bloquea el ingreso", async () => {
    rpc.mockImplementationOnce(async () => ({ data: null, error: { message: "caída" } }) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await limitarAuth(peticion("7.7.7.7"), "login")).toBeNull();
  });
});
