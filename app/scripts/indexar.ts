// Corre el indexador una vez desde la terminal: npm run indexar
import { sincronizar } from "../lib/indexer";

sincronizar()
  .then((r) => console.log(`Eventos nuevos: ${r.eventos} · hasta el ledger ${r.hastaLedger}`))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
