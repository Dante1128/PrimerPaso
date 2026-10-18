import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  fundWithFriendbot,
  tieneTrustlineUsdc,
  construirTrustlineXdr,
  enviarUsdcDePrueba,
  enviarXdrFirmado,
} from "@/lib/stellar";

const MONTO = process.env.FAUCET_USDC_AMOUNT ?? "500";

/**
 * Faucet de Testnet. Acciones:
 *  - "airdrop":  fondea XLM con Friendbot.
 *  - "trustline": devuelve el XDR de changeTrust para firmar con la wallet.
 *  - "submit":   envía el XDR de la trustline ya firmado.
 *  - "usdc":     el emisor envía USDC de prueba (requiere trustline).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action: string = body?.action ?? "";
  const address: string = body?.address ?? user.walletAddress ?? "";

  if (!/^G[A-Z2-7]{55}$/.test(address)) {
    return NextResponse.json({ error: "Dirección inválida" }, { status: 400 });
  }

  if (action === "airdrop") {
    const r = await fundWithFriendbot(address);
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  }

  if (action === "trustline") {
    if (await tieneTrustlineUsdc(address)) {
      return NextResponse.json({ ok: true, yaExiste: true });
    }
    try {
      const xdr = await construirTrustlineXdr(address);
      return NextResponse.json({ ok: true, xdr });
    } catch (e) {
      const err = e as { message?: string };
      return NextResponse.json(
        { error: err.message ?? "No se pudo crear la trustline" },
        { status: 500 },
      );
    }
  }

  if (action === "submit") {
    const xdr: string = body?.xdr ?? "";
    if (!xdr) {
      return NextResponse.json({ error: "Falta el XDR firmado" }, { status: 400 });
    }
    const r = await enviarXdrFirmado(xdr);
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  }

  if (action === "usdc") {
    if (!(await tieneTrustlineUsdc(address))) {
      return NextResponse.json(
        { error: "La cuenta aún no tiene trustline al USDC" },
        { status: 400 },
      );
    }
    const r = await enviarUsdcDePrueba(address, MONTO);
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  }

  return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
}
