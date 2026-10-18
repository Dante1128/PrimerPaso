// Perfil crediticio propio (puntaje, historial y credencial) desde la cadena,
// más el saldo USDC de la wallet.
import { exigirUsuario, manejar, ErrorApi } from "@/lib/api";
import { perfilCrediticio } from "@/lib/credito";
import { balanceUsdc } from "@/lib/stellar";
import { aUsdc } from "@/lib/soroban";

export const GET = manejar(async () => {
  const user = await exigirUsuario();
  if (!user.wallet) throw new ErrorApi("Sin wallet vinculada");
  const [perfil, saldo] = await Promise.all([perfilCrediticio(user.wallet), balanceUsdc(user.wallet)]);
  return Response.json({ perfil, saldoUsdc: aUsdc(saldo) });
});
