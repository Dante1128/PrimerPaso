import "server-only";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { ErrorApi } from "@/lib/api";
import { NETWORK_PASSPHRASE } from "@/lib/stellar";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

/** El hash cubre argumentos, autorizaciones, fuente y vencimiento; excluye firmas. */
export async function registrarPreparada(xdr: string, profileId: string, entityId: string, method: string) {
  const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
  if ("innerTransaction" in tx) throw new ErrorApi("Transacción no soportada");
  const { error } = await supabaseAdmin().from("prepared_transactions").upsert({
    tx_hash: Buffer.from(tx.hash()).toString("hex"), profile_id: profileId, entity_id: entityId, method,
    expires_at: new Date(Number(tx.timeBounds!.maxTime) * 1000).toISOString(),
  }, { onConflict: "tx_hash", ignoreDuplicates: true });
  if (error) throw new ErrorApi(`No se pudo registrar la transacción: ${error.message}`, 500);
}

export async function exigirPreparada(hash: string, profileId: string, entityId: string, method: string) {
  const { data, error } = await supabaseAdmin().from("prepared_transactions").select("*").eq("tx_hash", hash).maybeSingle();
  if (error) throw new ErrorApi("No se pudo comprobar la transacción", 503);
  if (!data || data.profile_id !== profileId || data.entity_id !== entityId || data.method !== method) {
    throw new ErrorApi("La transacción no corresponde a esta solicitud. Prepárala de nuevo.", 403);
  }
  if (!data.confirmed_at && Date.parse(data.expires_at) < Date.now()) {
    // Una confirmación tardía todavía puede recuperarse por el indexador.
    throw new ErrorApi("La transacción venció. Actualiza el panel antes de preparar otra.", 409);
  }
  return data;
}

export async function confirmarPreparada(hash: string, result: Json) {
  const { error } = await supabaseAdmin().from("prepared_transactions")
    .update({ confirmed_at: new Date().toISOString(), result }).eq("tx_hash", hash);
  if (error) throw new ErrorApi("Transacción enviada; falta actualizar su registro. Actualiza el panel.", 503);
}
