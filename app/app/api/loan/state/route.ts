import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  leerPrestamo,
  leerPuntaje,
  leerRegistro,
  leerCredencial,
} from "@/lib/soroban";
import { balanceUsdc } from "@/lib/stellar";

/** Estado completo del panel para la wallet del usuario logueado. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!user.walletAddress) {
    return NextResponse.json({ error: "Sin wallet vinculada" }, { status: 400 });
  }

  const wallet = user.walletAddress;
  try {
    const [prestamo, puntaje, registro, credencial, usdc] = await Promise.all([
      leerPrestamo(wallet),
      leerPuntaje(wallet),
      leerRegistro(wallet),
      leerCredencial(wallet),
      balanceUsdc(wallet),
    ]);
    return NextResponse.json({
      wallet,
      prestamo,
      puntaje,
      registro,
      credencial,
      usdcBalance: usdc,
    });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: err.message ?? "No se pudo leer el estado on-chain" },
      { status: 502 },
    );
  }
}
