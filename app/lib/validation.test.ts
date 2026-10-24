import { describe, expect, it } from "vitest";
import {
  loginSchema,
  pagoSchema,
  parametrosSchema,
  registroSchema,
  solicitudSchema,
  verificarCodigoSchema,
} from "@/lib/validation";

describe("validación de entradas", () => {
  it("normaliza el email (espacios y mayúsculas)", () => {
    const r = loginSchema.parse({ email: "  Ana@PrimerPaso.TEST ", password: "x" });
    expect(r.email).toBe("ana@primerpaso.test");
  });

  it("exige contraseña de al menos 8 caracteres al registrarse", () => {
    expect(registroSchema.safeParse({ fullName: "Ana Rojas", email: "a@b.co", password: "corta" }).success).toBe(false);
    expect(registroSchema.safeParse({ fullName: "Ana Rojas", email: "a@b.co", password: "suficiente" }).success).toBe(true);
  });

  it("el código de ingreso tiene 6 a 8 dígitos", () => {
    expect(verificarCodigoSchema.safeParse({ email: "a@b.co", code: "12345" }).success).toBe(false);
    expect(verificarCodigoSchema.safeParse({ email: "a@b.co", code: "123456" }).success).toBe(true);
    expect(verificarCodigoSchema.safeParse({ email: "a@b.co", code: "12a456" }).success).toBe(false);
  });

  it("la solicitud solo acepta propósitos conocidos y monto positivo", () => {
    const base = { amountUsd: "1000", installments: "10", purpose: "tuition" };
    expect(solicitudSchema.parse(base)).toMatchObject({ amountUsd: 1000, installments: 10 });
    expect(solicitudSchema.safeParse({ ...base, purpose: "viaje" }).success).toBe(false);
    expect(solicitudSchema.safeParse({ ...base, amountUsd: "-5" }).success).toBe(false);
  });

  it("el pago exige un id de préstamo positivo", () => {
    expect(pagoSchema.safeParse({ loanId: 0 }).success).toBe(false);
    expect(pagoSchema.parse({ loanId: "4" }).loanId).toBe(4);
  });

  it("los parámetros del admin respetan los rangos en bps", () => {
    const ok = {
      max_ltv_bps: "8000",
      rate_bps: 800,
      origination_fee_bps: 100,
      late_fee_bps: 200,
      yield_share_platform_bps: 2500,
      grace_seconds: 120,
      min_amount_usd: 100,
      max_amount_usd: 3000,
      max_installments: 12,
    };
    expect(parametrosSchema.parse(ok).max_ltv_bps).toBe(8000);
    expect(parametrosSchema.safeParse({ ...ok, max_ltv_bps: 10_001 }).success).toBe(false);
    expect(parametrosSchema.safeParse({ ...ok, origination_fee_bps: 10_000 }).success).toBe(false);
  });
});
