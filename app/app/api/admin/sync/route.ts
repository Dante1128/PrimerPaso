// Corre el indexador a pedido desde el panel del admin.
import { exigirUsuario, manejar } from "@/lib/api";
import { sincronizar } from "@/lib/indexer";

export const POST = manejar(async () => {
  await exigirUsuario(["admin"]);
  return Response.json({ ok: true, ...(await sincronizar()) });
});
