// Envía el pago ya firmado con la wallet y actualiza la caché.
import { exigirUsuario, manejar, ErrorApi, auditar, linkTx } from "@/lib/api";
import { pagoSchema } from "@/lib/validation";
import { LOAN_ID, validarXdr } from "@/lib/soroban";
import { enviarYEsperar } from "@/lib/stellar";
import { sincronizar } from "@/lib/indexer";

export const POST = manejar(async (req: Request) => {
  const user = await exigirUsuario(["student", "guarantor"]);
  const parsed = pagoSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || !parsed.data.signedXdr) throw new ErrorApi("Falta la transacción firmada");

  const tx = validarXdr(parsed.data.signedXdr, LOAN_ID, "repay", user.wallet ?? "");
  const r = await enviarYEsperar(tx);
  if (!r.ok) throw new ErrorApi(`El pago falló (${r.detail ?? "sin detalle"})`, 502);

  await auditar(user.id, "payment_submitted", "loan", String(parsed.data.loanId), { tx_hash: r.hash });
  await sincronizar().catch((e) => console.error("[indexer]", e));
  return Response.json({ ok: true, hash: r.hash, link: linkTx(r.hash) });
});
