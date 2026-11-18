import { describe, expect, it } from "vitest";
import { checkpointPagina, completarCuotas } from "./proyeccion";

describe("checkpoint del indexador", () => {
  it("conserva el cursor aunque el límite corte el mismo ledger", () => {
    expect(checkpointPagina([{ ledger: 40 }, { ledger: 40 }], "40-2", 100, 30, 2))
      .toEqual({ ledger: 39, cursor: "40-2", completa: false });
  });
  it("solo avanza hasta la red al terminar todas las páginas", () => {
    expect(checkpointPagina([], "fin", 100, 39)).toEqual({ ledger: 99, cursor: null, completa: true });
  });
  it("rechaza páginas completas sin cursor para no perder eventos", () => {
    expect(() => checkpointPagina([{ ledger: 40 }], "", 100, 30, 1)).toThrow("sin cursor");
  });
});

describe("reconstrucción de cuotas", () => {
  const fechas = ["2026-01-10T00:00:00Z", "2026-02-10T00:00:00Z", "2026-03-10T00:00:00Z"];
  const pago = (capital: bigint, fecha: string, ledger: number, hash: string) => ({ capital, fecha, ledger, hash, orden: 0, indice: 0 });
  it("los pagos parciales no completan cuotas futuras por leer un saldo más reciente", () => {
    expect(completarCuotas(100n, 3, [pago(20n, fechas[0], 1, "a")], fechas)).toEqual([]);
    expect(completarCuotas(100n, 3, [pago(20n, fechas[0], 1, "a"), pago(13n, fechas[1], 2, "b")], fechas))
      .toEqual([{ numero: 1, fecha: fechas[1], puntual: false, hash: "b" }]);
  });
  it("un solo pago puede completar una cuota atrasada y otra puntual", () => {
    const fecha = "2026-01-20T00:00:00Z";
    expect(completarCuotas(100n, 3, [pago(66n, fecha, 1, "a")], fechas).map((c) => c.puntual)).toEqual([false, true]);
  });
  it("ordena por ledger y transacción y absorbe el resto en la última cuota", () => {
    const pagos = [pago(34n, fechas[2], 3, "c"), pago(33n, fechas[1], 2, "b"), pago(33n, fechas[0], 1, "a")];
    expect(completarCuotas(100n, 3, pagos, fechas).map((c) => c.hash)).toEqual(["a", "b", "c"]);
    expect(completarCuotas(100n, 3, [...pagos.slice(1), pago(33n, fechas[2], 3, "c")], fechas)).toHaveLength(2);
  });
});
