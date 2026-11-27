import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServidor: async () => ({}) }));

const { pasoPendiente } = await import("@/lib/seguridad/auth");
import type { Usuario } from "@/lib/seguridad/auth";

const BASE: Usuario = {
  id: "u1",
  email: "a@b.co",
  fullName: "Ana",
  role: "student",
  rolElegido: false,
  esStaff: false,
  estudiante: null,
  kycStatus: null,
  kycMotivo: null,
  wallet: null,
  sesion: { aal: "aal1", metodos: [] },
  mfaConfigurado: false,
};

describe("pasoPendiente", () => {
  it("sin wallet, el primer paso es 'cuenta' (login de Pollar) aunque ya tenga rol elegido", () => {
    // Regresión: antes de login con Pollar, la wallet llega PRIMERO que el
    // rol — si "cuenta" no fuera el primer chequeo, un usuario con rol ya
    // elegido pero sin wallet nunca volvería a vincularla.
    expect(pasoPendiente({ ...BASE, wallet: null, rolElegido: true })).toBe("cuenta");
  });

  it("con wallet pero sin rol elegido, el paso es 'rol'", () => {
    expect(pasoPendiente({ ...BASE, wallet: "GABC", rolElegido: false })).toBe("rol");
  });

  it("estudiante con rol pero sin datos universitarios: 'universidad'", () => {
    expect(pasoPendiente({ ...BASE, wallet: "GABC", rolElegido: true, role: "student", estudiante: null })).toBe("universidad");
  });

  it("garante con rol elegido no pasa por 'universidad'", () => {
    expect(pasoPendiente({ ...BASE, wallet: "GABC", rolElegido: true, role: "guarantor", kycStatus: null })).toBe("identidad");
  });

  it("sin KYC enviado: 'identidad'", () => {
    expect(
      pasoPendiente({ ...BASE, wallet: "GABC", rolElegido: true, estudiante: {} as never, kycStatus: null }),
    ).toBe("identidad");
  });

  it("con todo listo: null (va al panel)", () => {
    expect(
      pasoPendiente({ ...BASE, wallet: "GABC", rolElegido: true, estudiante: {} as never, kycStatus: "approved" }),
    ).toBeNull();
  });

  it("el staff nunca tiene paso pendiente, aunque le falte todo", () => {
    expect(pasoPendiente({ ...BASE, esStaff: true, wallet: null, rolElegido: false })).toBeNull();
  });
});
