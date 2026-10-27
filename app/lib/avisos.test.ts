import { describe, expect, it } from "vitest";
import { textoAviso } from "@/lib/avisos";

describe("textos de los avisos", () => {
  it("cada aviso dice qué pasó y qué hacer", () => {
    expect(textoAviso({ type: "kyc_approved", payload: {} })).toMatch(/aprobada.*pedir tu préstamo/);
    expect(textoAviso({ type: "application_approved", payload: {} })).toMatch(/bloquea la garantía/);
  });

  it("los rechazos muestran el motivo que escribió el operador", () => {
    expect(textoAviso({ type: "kyc_rejected", payload: { reason: "foto borrosa" } })).toBe(
      "No pudimos verificar tu identidad. Motivo: foto borrosa. Vuelve a enviarla desde tu panel.",
    );
    expect(textoAviso({ type: "application_rejected", payload: null })).toBe(
      "Tu solicitud fue rechazada. Puedes enviar una nueva.",
    );
  });

  it("la liquidación nombra el préstamo", () => {
    expect(textoAviso({ type: "loan_liquidated", payload: { loan_id: 4 } })).toMatch(/préstamo #4/);
  });

  it("un tipo desconocido no rompe la campana", () => {
    expect(textoAviso({ type: "otro", payload: null })).toBe("Tienes una novedad en tu panel.");
  });
});
