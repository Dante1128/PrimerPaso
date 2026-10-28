// Renueva la vida (TTL) en la cadena de los préstamos activos: npm run renovar
import { renovarPrestamos, renovarHistoriales } from "../lib/renovacion";

renovarPrestamos()
  .then(async (r) => {
    console.log(`Préstamos activos revisados: ${r.revisados} · renovados: ${r.renovados.join(", ") || "ninguno"}`);
    if (r.archivados.length) console.log(`Archivados (restaurar a mano): ${r.archivados.join(", ")}`);
    for (const e of r.errores) console.log(`Error en #${e.loanId}: ${e.error}`);
    const historiales = await renovarHistoriales();
    console.log("Historiales:", historiales);
    if (r.errores.length || r.archivados.length || historiales.errores.length || historiales.archivados.length) process.exit(1);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
