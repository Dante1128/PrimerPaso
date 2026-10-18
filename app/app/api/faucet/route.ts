// Faucet de Testnet (dinero de prueba). Acciones:
//  - "airdrop":   fondea XLM con Friendbot.
//  - "trustline": devuelve el XDR de changeTrust al USDC para firmar con la wallet.
//  - "submit":    envía la trustline ya firmada.
//  - "usdc":      el emisor envía USDC de prueba (requiere trustline).
import { getSessionUser, errorJson } from "@/lib/auth";
import {
  fundWithFriendbot,
  tieneTrustlineUsdc,
  construirTrustlineXdr,
  enviarUsdcDePrueba,
  enviarXdrFirmado,
} from "@/lib/stellar";

/** USDC de prueba por solicitud: alcanza para la garantía del ejemplo (1.250) + intereses. */
const MONTO_USDC = "1500";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return errorJson("No autenticado", 401);
  if (!user.wallet) return errorJson("Primero vincula tu wallet", 400);

  const body = await req.json().catch(() => ({}));
  const action: string = body?.action ?? "";
  const address = user.wallet;

  if (action === "airdrop") {
    const r = await fundWithFriendbot(address);
    return Response.json(r, { status: r.ok ? 200 : 502 });
  }

  if (action === "trustline") {
    if (await tieneTrustlineUsdc(address)) return Response.json({ ok: true, yaExiste: true });
    try {
      return Response.json({ ok: true, xdr: await construirTrustlineXdr(address) });
    } catch (e) {
      return errorJson((e as Error).message ?? "No se pudo crear la trustline", 500);
    }
  }

  if (action === "submit") {
    const xdr: string = body?.xdr ?? "";
    if (!xdr) return errorJson("Falta el XDR firmado", 400);
    const r = await enviarXdrFirmado(xdr);
    return Response.json(r, { status: r.ok ? 200 : 502 });
  }

  if (action === "usdc") {
    if (!(await tieneTrustlineUsdc(address))) return errorJson("La cuenta aún no tiene trustline al USDC", 400);
    const r = await enviarUsdcDePrueba(address, MONTO_USDC);
    return Response.json(r, { status: r.ok ? 200 : 502 });
  }

  return errorJson("Acción desconocida", 400);
}
