// Envía a la red la transacción de un paso del préstamo, ya firmada con la
// wallet. La caché la actualiza el indexador en segundo plano.
import { exigirUsuario, manejar, ErrorApi, auditar, linkTx } from "@/lib/api";
import { pasoPrestamoSchema } from "@/lib/validation";
import { solicitudParaActuar } from "@/lib/prestamos";
import { LOAN_ID, validarXdr } from "@/lib/soroban";
import { enviarYEsperar } from "@/lib/stellar";
import { sincronizarEnSegundoPlano } from "@/lib/indexer";
import { exigirPreparada, confirmarPreparada } from "@/lib/transacciones";

export const POST = manejar(async (req: Request) => {
  const user = await exigirUsuario(["student", "guarantor"]);
  const parsed = pasoPrestamoSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || !parsed.data.signedXdr) throw new ErrorApi("Falta la transacción firmada");
  const { applicationId, step, signedXdr } = parsed.data;
  const metodo = step === "deposit" ? "deposit_collateral" : "open_loan";
  const tx = validarXdr(signedXdr, LOAN_ID, metodo, user.wallet!);
  const hash = Buffer.from(tx.hash()).toString("hex");
  const preparada = await exigirPreparada(hash, user.id, applicationId, metodo);
  if (preparada.confirmed_at) return Response.json({ ok: true, hash, link: linkTx(hash), ...(preparada.result as object) });
  const { app } = await solicitudParaActuar(applicationId, user);
  const r = await enviarYEsperar(tx);
  if (!r.ok) throw new ErrorApi(`La transacción falló (${r.detail ?? "sin detalle"})`, 502);

  const id = r.returnValue !== undefined ? Number(r.returnValue as bigint) : null;
  await confirmarPreparada(hash, step === "deposit" ? { positionId: id } : { loanId: id });
  if (step === "deposit") {
    await auditar(user.id, "collateral_deposited", "loan_application", app.id, {
      position_id: id,
      tx_hash: r.hash,
      depositor: user.wallet,
    });
  } else {
    await auditar(user.id, "loan_opened", "loan_application", app.id, { loan_id: id, tx_hash: r.hash });
  }

  sincronizarEnSegundoPlano();

  return Response.json({
    ok: true,
    hash: r.hash,
    link: linkTx(r.hash),
    ...(step === "deposit" ? { positionId: id } : { loanId: id }),
  });
});
