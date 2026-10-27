// Estado de préstamos.
//  GET ?loanId=<id on-chain> → detalle: caché + estado y cotización en vivo
//                               desde la cadena, cuotas, pagos y garantía.
//  GET (sin parámetros)      → préstamos del usuario (staff: todos).
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirUsuario, manejar, ErrorApi } from "@/lib/api";
import { puedeVerPrestamo } from "@/lib/prestamos";
import { LOAN_ID, aUsdc, cotizarPago, leerPrestamo } from "@/lib/soroban";

/** Cotización en USDC (número) para el cliente. */
async function cotizacion(onchainId: number) {
  const q = await cotizarPago(onchainId);
  if (!q) return null;
  return {
    interes: aUsdc(q.interest_due),
    capitalProximaCuota: aUsdc(q.next_installment_principal),
    totalProximaCuota: aUsdc(q.interest_due + q.next_installment_principal),
    saldoCapital: aUsdc(q.principal_outstanding),
    vence: new Date(Number(q.next_due_ts) * 1000).toISOString(),
    vencido: aUsdc(q.overdue_amount),
    enMora: q.overdue,
    liquidable: q.liquidatable,
    recargo: aUsdc(q.late_fee),
  };
}

export const GET = manejar(async (req: Request) => {
  const user = await exigirUsuario();
  const db = supabaseAdmin();
  const loanId = new URL(req.url).searchParams.get("loanId");

  if (!loanId) {
    let q = db.from("loans").select("*").eq("loan_contract_id", LOAN_ID).order("onchain_loan_id", { ascending: false });
    if (!user.esStaff) {
      const filtros = [`student_id.eq.${user.id}`];
      if (user.wallet) filtros.push(`depositor_address.eq.${user.wallet}`);
      if (user.role === "guarantor") {
        // También los préstamos de los estudiantes que respalda.
        const { data: apps } = await db.from("loan_applications").select("id").eq("guarantor_id", user.id);
        if (apps?.length) filtros.push(`application_id.in.(${apps.map((a) => a.id).join(",")})`);
      }
      q = q.or(filtros.join(","));
    }
    const { data, error } = await q;
    if (error) throw new ErrorApi(error.message, 500);
    const prestamos = await Promise.all(
      (data ?? []).map(async (l) => ({ ...l, cotizacion: l.status === "active" ? await cotizacion(l.onchain_loan_id) : null })),
    );
    return Response.json({ prestamos });
  }

  const { data: loan } = await db
    .from("loans")
    .select("*")
    .eq("loan_contract_id", LOAN_ID)
    .eq("onchain_loan_id", Number(loanId))
    .maybeSingle();
  if (!loan) throw new ErrorApi("Préstamo no encontrado", 404);
  if (!(await puedeVerPrestamo(loan, user))) throw new ErrorApi("No tienes acceso a este préstamo", 403);

  const [onchain, cot, cuotas, pagos, garantia] = await Promise.all([
    leerPrestamo(loan.onchain_loan_id),
    loan.status === "active" ? cotizacion(loan.onchain_loan_id) : null,
    db.from("installments").select("*").eq("loan_id", loan.id).order("number"),
    db.from("payments").select("*").eq("loan_id", loan.id).order("created_at"),
    db.from("collateral_events").select("*").eq("loan_id", loan.id).order("created_at"),
  ]);

  return Response.json({
    prestamo: loan,
    cadena: onchain && {
      estado: onchain.status,
      capitalPagado: aUsdc(onchain.principal_paid),
      interesPagado: aUsdc(onchain.interest_paid),
      garantiaLiberada: aUsdc(onchain.collateral_released),
      garantiaInicial: aUsdc(onchain.collateral_initial),
      cuotasPagadas: onchain.installments_paid,
    },
    // Desde cuándo se puede cobrar de la garantía: vencimiento + la gracia de este préstamo.
    cotizacion: cot && {
      ...cot,
      cobroDesde: onchain ? new Date(Date.parse(cot.vence) + Number(onchain.terms.grace_seconds) * 1000).toISOString() : null,
    },
    cuotas: cuotas.data ?? [],
    pagos: pagos.data ?? [],
    garantia: garantia.data ?? [],
  });
});
