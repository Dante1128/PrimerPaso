// Mora y liquidación (solo admin).
//  GET  → préstamos activos con su cotización en vivo (mora, liquidable, recargo).
//  POST → { loanId } liquida on-chain firmando como admin: la treasury cobra
//         capital + interés + recargo y el remanente vuelve al depositante.
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirUsuario, manejar, ErrorApi, auditar, notificar, linkTx } from "@/lib/api";
import { LOAN_ID, aUsdc, adminKeypair, arg, cotizarPago, ejecutarComoServidor } from "@/lib/soroban";
import { sincronizarEnSegundoPlano } from "@/lib/indexer";

export const GET = manejar(async () => {
  await exigirUsuario(["admin"]);
  const { data, error } = await supabaseAdmin()
    .from("loans")
    .select("id, onchain_loan_id, student_id, borrower_address, depositor_address, principal, outstanding, collateral_locked, status, student:profiles!loans_student_id_fkey(full_name)")
    .eq("loan_contract_id", LOAN_ID)
    .eq("status", "active")
    .order("onchain_loan_id");
  if (error) throw new ErrorApi(error.message, 500);

  const prestamos = await Promise.all(
    (data ?? []).map(async (l) => {
      const q = await cotizarPago(l.onchain_loan_id);
      return {
        ...l,
        enMora: q?.overdue ?? false,
        liquidable: q?.liquidatable ?? false,
        vence: q ? new Date(Number(q.next_due_ts) * 1000).toISOString() : null,
        vencido: q ? aUsdc(q.overdue_amount) : 0,
        recargo: q ? aUsdc(q.late_fee) : 0,
      };
    }),
  );
  return Response.json({ prestamos });
});

export const POST = manejar(async (req: Request) => {
  const user = await exigirUsuario(["admin"]);
  const parsed = z.object({ loanId: z.coerce.number().int().positive() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ErrorApi("Datos inválidos");
  const { loanId } = parsed.data;

  const q = await cotizarPago(loanId);
  if (!q) throw new ErrorApi("El préstamo no está activo");
  if (!q.liquidatable) throw new ErrorApi("El préstamo aún no está en mora o la gracia no terminó");

  const admin = adminKeypair();
  const r = await ejecutarComoServidor(admin, LOAN_ID, "liquidate", [arg.address(admin.publicKey()), arg.u64(loanId)]);
  if (!r.ok) throw new ErrorApi(`La liquidación falló (${r.detail ?? "sin detalle"})`, 502);

  await auditar(user.id, "loan_liquidated", "loan", String(loanId), { tx_hash: r.hash });
  sincronizarEnSegundoPlano();

  const { data: loan } = await supabaseAdmin()
    .from("loans")
    .select("student_id")
    .eq("loan_contract_id", LOAN_ID)
    .eq("onchain_loan_id", loanId)
    .maybeSingle();
  if (loan?.student_id) await notificar(loan.student_id, "loan_liquidated", { loan_id: loanId, tx_hash: r.hash });

  return Response.json({ ok: true, hash: r.hash, link: linkTx(r.hash) });
});
