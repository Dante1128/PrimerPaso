/** Checkpoint seguro: una página llena necesita conservar su cursor exacto. */
export function checkpointPagina(eventos: { ledger: number }[], cursor: string, latest: number, anterior: number, limite = 200) {
  const completa = eventos.length < limite;
  if (!completa && !cursor) throw new Error("El RPC devolvió una página llena sin cursor");
  return {
    ledger: completa ? Math.max(anterior, latest - 1) : Math.max(anterior, (eventos.at(-1)?.ledger ?? anterior + 1) - 1),
    cursor: completa ? null : cursor,
    completa,
  };
}

export type PagoHistorico = { capital: bigint; fecha: string; ledger: number; orden: number; indice: number; hash: string };

/** Reconstruye desde eventos, nunca desde el saldo actual de la cadena. */
export function completarCuotas(capital: bigint, numeroCuotas: number, pagos: PagoHistorico[], vencimientos: string[]) {
  const ordenados = [...pagos].sort((a, b) => a.ledger - b.ledger || a.orden - b.orden || a.indice - b.indice);
  let acumulado = BigInt(0);
  let siguiente = 1;
  const resultado: { numero: number; fecha: string; puntual: boolean; hash: string }[] = [];
  for (const pago of ordenados) {
    acumulado += pago.capital;
    while (siguiente <= numeroCuotas) {
      const objetivo = siguiente === numeroCuotas ? capital : capital / BigInt(numeroCuotas) * BigInt(siguiente);
      if (acumulado < objetivo) break;
      resultado.push({ numero: siguiente, fecha: pago.fecha, puntual: Date.parse(pago.fecha) <= Date.parse(vencimientos[siguiente - 1]), hash: pago.hash });
      siguiente++;
    }
  }
  return resultado;
}
