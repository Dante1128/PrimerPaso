// Corre el indexador una vez desde la terminal: npm run indexar
import { sincronizar } from "../lib/indexer";

sincronizar({ esperarMs: 30_000 })
  .then((r) => {
    if (r.ocupado) return console.log("Otro indexador está corriendo; inténtalo en un momento.");
    console.log(`Eventos procesados: ${r.eventos} · hasta el ledger ${r.hastaLedger} · pendientes: ${r.pendientes}`);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
