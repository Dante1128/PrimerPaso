// Prepara el pago de una cuota en USDC (on-chain) para firmar con la wallet.
// Sin montos, paga la próxima cuota completa: interés pendiente + capital.
// Puede pagar el estudiante o su garante.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirUsuario, manejar, ErrorApi } from "@/lib/api";
import { pagoSchema } from "@/lib/validation";
import { puedeVerPrestamo } from "@/lib/prestamos";
import { LOAN_ID, aStroops, aUsdc, arg, cotizarPago, prepararParaWallet } from "@/lib/soroban";
import { balanceUsdc } from "@/lib/stellar";
import { registrarPreparada } from "@/lib/transacciones";

export const POST = manejar(async (req: Request) => {
  const user = await exigirUsuario(["student", "guarantor"]);
  if (!user.wallet) throw new ErrorApi("Primero vincula tu wallet");
  const parsed = pagoSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ErrorApi("Datos inválidos");
  const { loanId, principalUsd, interestUsd } = parsed.data;

  const { data: loan } = await supabaseAdmin()
    .from("loans")
    .select("student_id, depositor_address, borrower_address, application_id, status")
    .eq("loan_contract_id", LOAN_ID)
    .eq("onchain_loan_id", loanId)
    .maybeSingle();
  if (!loan) throw new ErrorApi("Préstamo no encontrado", 404);
  if (!(await puedeVerPrestamo(loan, user))) throw new ErrorApi("No tienes acceso a este préstamo", 403);
  if (loan.status !== "active") throw new ErrorApi("El préstamo no está activo");

  const q = await cotizarPago(loanId);
  if (!q) throw new ErrorApi("No se pudo cotizar el préstamo", 502);
  const capital = principalUsd !== undefined ? aStroops(principalUsd) : q.next_installment_principal;
  const interes = interestUsd !== undefined ? aStroops(interestUsd) : q.interest_due;
  if (capital + interes <= BigInt(0)) throw new ErrorApi("No hay nada que pagar");

  if ((await balanceUsdc(user.wallet)) < capital + interes) {
    throw new ErrorApi(`Saldo insuficiente: necesitas ${aUsdc(capital + interes)} USDC`);
  }

  const xdr = await prepararParaWallet(user.wallet, LOAN_ID, "repay", [
    arg.address(user.wallet),
    arg.u64(loanId),
    arg.i128(capital),
    arg.i128(interes),
  ]);
  await registrarPreparada(xdr, user.id, String(loanId), "repay");
  return Response.json({ xdr, capital: aUsdc(capital), interes: aUsdc(interes), total: aUsdc(capital + interes) });
});
