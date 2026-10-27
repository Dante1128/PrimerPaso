import { describe, expect, it } from "vitest";
import { caminoEstudiante, type DatosCamino } from "@/lib/camino";
import { duracion, restante } from "@/lib/tiempo";

const base: DatosCamino = { kycStatus: "approved", solicitud: null, tienePrestamoActivo: false, terminoDePagar: false };
const estados = (d: Partial<DatosCamino>) => caminoEstudiante({ ...base, ...d }).pasos.map((p) => p.estado);

describe("camino del estudiante", () => {
  it("identidad aprobada y sin solicitud: le toca pedir el préstamo", () => {
    const c = caminoEstudiante(base);
    expect(c.pasos.map((p) => p.estado)).toEqual(["hecho", "actual", "pendiente", "pendiente", "pendiente"]);
    expect(c.ahora).toMatch(/envía tu solicitud/);
  });

  it("identidad en revisión no impide enviar la solicitud", () => {
    expect(estados({ kycStatus: "pending" })).toEqual(["revision", "actual", "pendiente", "pendiente", "pendiente"]);
  });

  it("identidad rechazada: lo primero es reenviarla", () => {
    const c = caminoEstudiante({ ...base, kycStatus: "rejected" });
    expect(c.pasos[0].estado).toBe("actual");
    expect(c.ahora).toMatch(/Vuelve a enviar tu identidad/);
  });

  it("solicitud en revisión dice cuánto tarda y qué hacer mientras", () => {
    const c = caminoEstudiante({ ...base, solicitud: { status: "submitted", garantia: 1250 } });
    expect(c.pasos[1].estado).toBe("revision");
    expect(c.ahora).toMatch(/24 h.*garantía/);
  });

  it("aprobada: primero la garantía, después la firma", () => {
    const sinGarantia = caminoEstudiante({ ...base, solicitud: { status: "approved", garantia: 1250, garantiaDepositada: false } });
    expect(sinGarantia.pasos.map((p) => p.estado)).toEqual(["hecho", "hecho", "actual", "pendiente", "pendiente"]);
    expect(sinGarantia.ahora).toBe("Bloquea 1.250 USDC de garantía (tú o tu garante).");
    expect(estados({ solicitud: { status: "approved", garantia: 1250, garantiaDepositada: true } })).toEqual([
      "hecho", "hecho", "hecho", "actual", "pendiente",
    ]);
  });

  it("con préstamo activo está en pagos", () => {
    expect(estados({ tienePrestamoActivo: true })).toEqual(["hecho", "hecho", "hecho", "hecho", "actual"]);
  });

  it("al terminar de pagar todo queda hecho", () => {
    const c = caminoEstudiante({ ...base, terminoDePagar: true });
    expect(c.pasos.every((p) => p.estado === "hecho")).toBe(true);
  });
});

describe("tiempos en palabras", () => {
  it("duración de cada cuota", () => {
    expect(duracion(300)).toBe("5 minutos");
    expect(duracion(60)).toBe("1 minuto");
    expect(duracion(7200)).toBe("2 horas");
    expect(duracion(2_592_000)).toBe("1 mes");
    expect(duracion(604_800)).toBe("7 días");
  });

  it("cuenta regresiva", () => {
    expect(restante(-1)).toBeNull();
    expect(restante(30_000)).toBe("1 min");
    expect(restante(105 * 60_000)).toBe("1 h 45 min");
    expect(restante(2 * 3_600_000)).toBe("2 h");
    expect(restante(50 * 3_600_000)).toBe("2 días 2 h");
  });
});
