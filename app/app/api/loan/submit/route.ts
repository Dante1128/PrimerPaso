import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { enviarInvocacion } from "@/lib/soroban";

/** Envía una invocación Soroban ya firmada por la wallet. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const xdr: string = body?.xdr ?? "";
  if (!xdr) {
    return NextResponse.json({ error: "Falta el XDR firmado" }, { status: 400 });
  }
  const r = await enviarInvocacion(xdr);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
