import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  prepararInvocacion,
  LOAN_ID,
  argAddress,
  argI128,
  argU32,
} from "@/lib/soroban";
import { usdcAStroops } from "@/lib/format";

/**
 * Prepara (sin firmar) una invocación al contrato de préstamo para la wallet
 * del usuario. Acciones: "deposit" | "open" | "repay".
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user?.walletAddress) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const wallet = user.walletAddress;
  const body = await req.json().catch(() => ({}));
  const action: string = body?.action ?? "";

  try {
    let method = "";
    let args;

    if (action === "deposit") {
      const monto = Number(body.amount);
      if (!(monto > 0)) throw new Error("Monto inválido");
      const s = argI128(usdcAStroops(monto));
      method = "deposit_collateral";
      args = [argAddress(wallet), argAddress(wallet), s];
    } else if (action === "open") {
      const principal = Number(body.principal);
      const installments = Number(body.installments);
      const interestRate = Number(body.interestRate);
      if (!(principal > 0) || !(installments > 0)) {
        throw new Error("Parámetros inválidos");
      }
      method = "open_loan";
      args = [
        argAddress(wallet),
        argI128(usdcAStroops(principal)),
        argU32(installments),
        argU32(interestRate),
      ];
    } else if (action === "repay") {
      const monto = Number(body.amount);
      if (!(monto > 0)) throw new Error("Monto inválido");
      method = "repay";
      args = [argAddress(wallet), argI128(usdcAStroops(monto))];
    } else {
      return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    }

    const xdr = await prepararInvocacion(wallet, LOAN_ID, method, args);
    return NextResponse.json({ ok: true, xdr });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: err.message ?? "No se pudo preparar la transacción" },
      { status: 400 },
    );
  }
}
