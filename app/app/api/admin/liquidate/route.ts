import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ejecutarComoAdmin, argAddress } from "@/lib/soroban";

/** Ejecuta la garantía (liquidate) de un préstamo en mora. Solo admin. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const borrower: string = body?.borrower ?? "";
  if (!/^G[A-Z2-7]{55}$/.test(borrower)) {
    return NextResponse.json({ error: "Dirección inválida" }, { status: 400 });
  }

  const r = await ejecutarComoAdmin("liquidate", [argAddress(borrower)]);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
