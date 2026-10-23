// El simulador debe dar exactamente lo mismo que el contrato `loan`.
import { describe, expect, it } from "vitest";
import { PARAMETROS_BASE, simular } from "@/lib/calculos";

/** Suma montos en la unidad mínima de USDC para no arrastrar errores de float. */
const enUnidades = (montos: number[]) => montos.reduce((a, m) => a + Math.round(m * 1e7), 0);

describe("simular: ejemplo de referencia (1.000 USDC en 10 cuotas)", () => {
  const s = simular(1000, 10);

  it("garantía, comisión y lo que recibe el estudiante", () => {
    expect(s.garantia).toBe(1250);
    expect(s.comision).toBe(10);
    expect(s.recibes).toBe(990);
  });

  it("interés total igual al del contrato (redondeo hacia abajo por periodo)", () => {
    expect(s.interesTotal).toBe(36.6666663);
    expect(s.totalPagado).toBe(1036.6666663);
    expect(s.costoNeto).toBe(46.6666663);
    expect(s.costoNetoPct).toBe(4.66);
  });

  it("cada pago libera 125 de garantía y la última cuota deja todo en cero", () => {
    expect(s.calendario).toHaveLength(10);
    expect(s.calendario.every((c) => c.garantiaLiberada === 125)).toBe(true);
    const ultima = s.calendario.at(-1)!;
    expect(ultima.saldoDespues).toBe(0);
    expect(ultima.garantiaLiberadaAcumulada).toBe(1250);
  });

  it("primera cuota: 100 de capital + interés de un mes sobre 1.000", () => {
    expect(s.calendario[0]).toMatchObject({ numero: 1, capital: 100, interes: 6.6666666, saldoDespues: 900 });
  });

  it("el interés baja con el saldo", () => {
    const intereses = s.calendario.map((c) => c.interes);
    expect(intereses).toEqual([...intereses].sort((a, b) => b - a));
  });
});

describe("simular: casos borde", () => {
  it("si el monto no se divide exacto, la última cuota absorbe el resto", () => {
    const s = simular(1000, 3);
    expect(s.calendario.map((c) => c.capital)).toEqual([333.3333333, 333.3333333, 333.3333334]);
    expect(enUnidades(s.calendario.map((c) => c.capital))).toBe(1000 * 1e7);
    expect(s.calendario.at(-1)!.garantiaLiberadaAcumulada).toBe(1250);
  });

  it("la garantía liberada suma exactamente la garantía inicial", () => {
    for (const [monto, cuotas] of [[100, 1], [777, 7], [3000, 12], [1234.56, 11]]) {
      const s = simular(monto, cuotas);
      expect(enUnidades(s.calendario.map((c) => c.garantiaLiberada))).toBe(Math.round(s.garantia * 1e7));
    }
  });

  it("la garantía se redondea hacia arriba para no pasar el LTV", () => {
    const s = simular(100, 1, { ...PARAMETROS_BASE, max_ltv_bps: 7000 });
    expect(s.garantia).toBe(142.8571429);
    expect(s.garantia * 0.7).toBeGreaterThanOrEqual(100);
  });

  it("sin tasa no hay interés y el costo es solo la comisión", () => {
    const s = simular(500, 5, { ...PARAMETROS_BASE, rate_bps: 0 });
    expect(s.interesTotal).toBe(0);
    expect(s.costoNeto).toBe(s.comision);
  });

  it("las cuotas se normalizan a un entero de al menos 1", () => {
    expect(simular(1000, 0).cuotas).toBe(1);
    expect(simular(1000, 2.7).cuotas).toBe(2);
  });

  it("una sola cuota paga todo con un mes de interés", () => {
    const s = simular(1000, 1);
    expect(s.calendario).toHaveLength(1);
    expect(s.interesTotal).toBe(6.6666666);
    expect(s.calendario[0].garantiaLiberada).toBe(1250);
  });
});
