// Perfil crediticio propio (puntaje, historial y credencial) desde la cadena,
// más el saldo USDC de la wallet.
import { exigirUsuario, manejar, ErrorApi } from "@/lib/comun/api";
import { perfilCrediticio } from "@/lib/cadena/credito";
import { balanceUsdc } from "@/lib/cadena/stellar";
import { aUsdc } from "@/lib/cadena/soroban";

export const GET = manejar(async () => {
  const user = await exigirUsuario();
  if (!user.wallet) throw new ErrorApi("Sin wallet vinculada");
  const [perfil, saldo] = await Promise.all([perfilCrediticio(user.wallet), balanceUsdc(user.wallet)]);
  return Response.json({ perfil, saldoUsdc: aUsdc(saldo) });
});
