"use client";
// Helpers del navegador: llamadas a la API y flujo de firma con la wallet.
import { useCallback, useState } from "react";
import { conectarFreighter, firmarXdr } from "@/lib/wallet";

export async function api<T = Record<string, unknown>>(url: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(url, {
    method: method ?? (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Ocurrió un error");
  return data as T;
}

/**
 * Prepara una transacción en el servidor, la firma con Freighter y la envía.
 * Verifica que Freighter esté en la misma cuenta vinculada al usuario.
 */
export async function firmarYEnviar(
  wallet: string,
  prepararUrl: string,
  enviarUrl: string,
  body: Record<string, unknown>,
): Promise<{ hash?: string; link?: string } & Record<string, unknown>> {
  const actual = await conectarFreighter();
  if (actual !== wallet) {
    throw new Error(`En Freighter elige la cuenta ${wallet.slice(0, 6)}…${wallet.slice(-6)} (la vinculada a tu perfil).`);
  }
  const { xdr } = await api<{ xdr: string }>(prepararUrl, body);
  const signedXdr = await firmarXdr(xdr, wallet);
  return api(enviarUrl, { ...body, signedXdr });
}

/** Espera a que el indexador procese la transacción (o se acabe el tiempo). */
export async function esperarIndexado(hash: string | undefined, maxMs = 30_000): Promise<boolean> {
  if (!hash) return false;
  const fin = Date.now() + maxMs;
  while (Date.now() < fin) {
    try {
      if ((await api<{ indexado: boolean }>(`/api/sync?tx=${hash}`)).indexado) return true;
    } catch {
      // Reintenta: puede ser un corte momentáneo.
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

/**
 * Tras enviar una transacción: muestra "actualizando" mientras el indexador
 * la procesa y después recarga los datos, sin bloquear al usuario.
 */
export function useRecargarTrasIndexar() {
  const [actualizando, setActualizando] = useState(false);
  const recargarTras = useCallback(async (hash: string | undefined, recargar: () => unknown) => {
    setActualizando(true);
    try {
      await esperarIndexado(hash);
    } finally {
      setActualizando(false);
    }
    await recargar();
  }, []);
  return { actualizando, recargarTras };
}

/** Red de pruebas: hay faucet de USDC y dinero sin valor real. */
export const ES_TESTNET = process.env.NEXT_PUBLIC_STELLAR_NETWORK !== "PUBLIC";

export type PasoFondeo = "xlm" | "trust" | "usdc";

/**
 * Deja la wallet lista con USDC de prueba (solo testnet): activa la cuenta,
 * habilita el USDC (lo aprueba el usuario en Freighter) y envía 1.500 USDC.
 * Cada paso se puede repetir sin problema.
 */
export async function fondearPrueba(wallet: string, alAvanzar?: (paso: PasoFondeo, estado: "haciendo" | "ok") => void) {
  alAvanzar?.("xlm", "haciendo");
  await api("/api/faucet", { action: "airdrop" });
  alAvanzar?.("xlm", "ok");

  alAvanzar?.("trust", "haciendo");
  const t = await api<{ yaExiste?: boolean; xdr?: string }>("/api/faucet", { action: "trustline" });
  if (!t.yaExiste && t.xdr) {
    const firmado = await firmarXdr(t.xdr, wallet);
    await api("/api/faucet", { action: "submit", xdr: firmado });
  }
  alAvanzar?.("trust", "ok");

  alAvanzar?.("usdc", "haciendo");
  await api("/api/faucet", { action: "usdc" });
  alAvanzar?.("usdc", "ok");
}

/** Copia un texto; false si el navegador no lo permite. */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
