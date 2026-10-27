import { describe, expect, it } from "vitest";
import { paraContrato, paraEditar } from "@/lib/parametros";

// Valores reales del contrato desplegado en testnet.
const CONTRATO = {
  max_ltv_bps: 8000,
  rate_bps: 800,
  origination_fee_bps: 100,
  late_fee_bps: 200,
  yield_share_platform_bps: 2500,
  grace_seconds: 120,
  min_amount_usd: 100,
  max_amount_usd: 3000,
  max_installments: 12,
};

describe("parámetros en % y minutos", () => {
  it("el admin ve porcentajes y minutos", () => {
    expect(paraEditar(CONTRATO)).toEqual({
      max_ltv_bps: 80,
      rate_bps: 8,
      origination_fee_bps: 1,
      late_fee_bps: 2,
      yield_share_platform_bps: 25,
      grace_seconds: 2,
      min_amount_usd: 100,
      max_amount_usd: 3000,
      max_installments: 12,
    });
  });

  it("guardar sin cambios deja el contrato exactamente igual", () => {
    expect(paraContrato(paraEditar(CONTRATO))).toEqual(CONTRATO);
  });

  it("los decimales se convierten a enteros sin errores de float", () => {
    const p = { ...paraEditar(CONTRATO), rate_bps: 7.25, origination_fee_bps: 0.07, grace_seconds: 43_200 };
    expect(paraContrato(p)).toMatchObject({ rate_bps: 725, origination_fee_bps: 7, grace_seconds: 2_592_000 });
  });

  it("acepta los valores como texto (así vienen de la API)", () => {
    expect(paraEditar({ ...CONTRATO, max_amount_usd: "3000.0000000" } as never).max_amount_usd).toBe(3000);
  });
});
