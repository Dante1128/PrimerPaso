"use client";
// Helpers del navegador: llamadas a la API y flujo de firma con la wallet.
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
