// ¿Ya está indexada esta transacción? El panel lo consulta después de un
// pago, desembolso, liquidación o cambio de parámetros para recargar los
// datos cuando la caché esté al día. Si aún no lo está, empuja el indexador.
import { exigirUsuario, manejar, ErrorApi } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sincronizarEnSegundoPlano } from "@/lib/indexer";

export const GET = manejar(async (req: Request) => {
  await exigirUsuario();
  const tx = new URL(req.url).searchParams.get("tx") ?? "";
  if (!/^[0-9a-f]{64}$/.test(tx)) throw new ErrorApi("Hash de transacción inválido");

  const { data, error } = await supabaseAdmin().from("onchain_events").select("processed").eq("tx_hash", tx);
  if (error) throw new Error(error.message);

  const indexado = !!data?.length && data.every((e) => e.processed);
  // Sin esperar el candado: si otro indexador ya corre, ese lo procesará.
  if (!indexado) sincronizarEnSegundoPlano(0);
  return Response.json({ indexado });
});
