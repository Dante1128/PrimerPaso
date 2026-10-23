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
