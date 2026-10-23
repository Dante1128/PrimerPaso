// Renueva la vida (TTL) en la cadena de los préstamos activos: npm run renovar
import { renovarPrestamos } from "../lib/renovacion";

renovarPrestamos()
  .then((r) => {
    console.log(`Préstamos activos revisados: ${r.revisados} · renovados: ${r.renovados.join(", ") || "ninguno"}`);
    if (r.archivados.length) console.log(`Archivados (restaurar a mano): ${r.archivados.join(", ")}`);
    for (const e of r.errores) console.log(`Error en #${e.loanId}: ${e.error}`);
    if (r.errores.length) process.exit(1);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
