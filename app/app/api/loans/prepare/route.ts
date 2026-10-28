// Prepara la transacción de un paso del préstamo para firmarla con la wallet.
//  step "deposit": el estudiante o su garante bloquea la garantía en USDC.
//  step "open":    el estudiante firma la apertura; el operator de
//                  PrimerPaso co-firma en el servidor (la solicitud ya fue
//                  aprobada por un operador). La treasury desembolsa monto − 1%.
import { exigirUsuario, manejar, ErrorApi, periodoSegundos } from "@/lib/api";
import { pasoPrestamoSchema } from "@/lib/validation";
import { solicitudParaActuar, posicionDeSolicitud } from "@/lib/prestamos";
import { LOAN_ID, aStroops, arg, leerPosicion, operatorKeypair, prepararParaWallet } from "@/lib/soroban";
import { tieneTrustlineUsdc, balanceUsdc } from "@/lib/stellar";
import { registrarPreparada } from "@/lib/transacciones";

export const POST = manejar(async (req: Request) => {
  const user = await exigirUsuario(["student", "guarantor"]);
  const parsed = pasoPrestamoSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ErrorApi("Datos inválidos");
  const { applicationId, step } = parsed.data;
  const { app, esEstudiante, walletEstudiante } = await solicitudParaActuar(applicationId, user);
  const wallet = user.wallet!;
  const posicion = await posicionDeSolicitud(app);

  if (step === "deposit") {
    if (posicion) {
      const p = await leerPosicion(posicion);
      if (p && p.status === "Open") throw new ErrorApi("La garantía ya está depositada");
    }
    const monto = aStroops(app.collateral_amount);
    if ((await balanceUsdc(wallet)) < monto) {
      throw new ErrorApi(`Necesitas ${Number(app.collateral_amount)} USDC en tu wallet para la garantía`);
    }
    const xdr = await prepararParaWallet(wallet, LOAN_ID, "deposit_collateral", [
      arg.address(wallet),
      arg.address(walletEstudiante),
      arg.i128(monto),
    ]);
    await registrarPreparada(xdr, user.id, app.id, "deposit_collateral");
    return Response.json({ xdr, monto: Number(app.collateral_amount) });
  }

  // step === "open"
  if (!esEstudiante) throw new ErrorApi("La apertura la firma el estudiante", 403);
  if (!posicion) throw new ErrorApi("Primero hay que depositar la garantía");
  const p = await leerPosicion(posicion);
  if (!p || p.status !== "Open") throw new ErrorApi("La garantía no está disponible para abrir el préstamo");
  if (p.borrower !== wallet || aStroops(app.collateral_amount) !== p.amount) throw new ErrorApi("La garantía no corresponde a esta solicitud");
  if (!(await tieneTrustlineUsdc(wallet))) throw new ErrorApi("Tu wallet necesita trustline al USDC para recibir el préstamo");

  const periodo = periodoSegundos();
  const primerVencimiento = Math.floor(Date.now() / 1000) + periodo;
  const xdr = await prepararParaWallet(
    wallet,
    LOAN_ID,
    "open_loan",
    [
      arg.address(operatorKeypair().publicKey()),
      arg.u64(posicion),
      arg.i128(aStroops(app.amount_usd)),
      arg.u32(app.installments),
      arg.u64(primerVencimiento),
      arg.u64(periodo),
    ],
    [operatorKeypair()],
  );
  await registrarPreparada(xdr, user.id, app.id, "open_loan");
  return Response.json({ xdr, primerVencimiento, periodo });
});
