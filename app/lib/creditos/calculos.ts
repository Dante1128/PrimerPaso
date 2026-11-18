// Simulación de un préstamo con la MISMA matemática del contrato `loan`
// (enteros en la unidad mínima de USDC, 7 decimales):
//   interés del periodo = saldo * rate_bps / 10000 / 12   (redondeo hacia abajo)
//   comisión            = monto * origination_fee_bps / 10000 (se descuenta del desembolso)
//   garantía            = monto * 10000 / max_ltv_bps
//   liberada acumulada  = capital_pagado * garantía / monto (el último pago libera todo)
// Se usa en el servidor y en el navegador.

export type Parametros = {
  max_ltv_bps: number;
  rate_bps: number;
  origination_fee_bps: number;
  late_fee_bps: number;
  min_amount_usd: number;
  max_amount_usd: number;
  max_installments: number;
};

/** Parámetros vigentes del modelo de negocio (por si aún no cargaron los reales). */
export const PARAMETROS_BASE: Parametros = {
  max_ltv_bps: 8000,
  rate_bps: 800,
  origination_fee_bps: 100,
  late_fee_bps: 200,
  min_amount_usd: 100,
  max_amount_usd: 3000,
  max_installments: 12,
};

const U = BigInt(10_000_000);
const BPS = BigInt(10_000);
const aUnidades = (usd: number) => BigInt(Math.round(usd * 1e7));
const aUsd = (v: bigint) => Number(v) / 1e7;

export type CuotaSimulada = {
  numero: number;
  capital: number;
  interes: number;
  total: number;
  saldoDespues: number;
  garantiaLiberada: number;
  garantiaLiberadaAcumulada: number;
};

export type Simulacion = {
  monto: number;
  cuotas: number;
  garantia: number;
  comision: number;
  recibes: number;
  interesTotal: number;
  /** Lo que pagas en cuotas: capital + interés. */
  totalPagado: number;
  /** Costo real del crédito: interés + comisión. */
  costoNeto: number;
  costoNetoPct: number;
  calendario: CuotaSimulada[];
};

/** Simula un préstamo pagado a tiempo, cuota por cuota. */
export function simular(montoUsd: number, cuotas: number, p: Parametros = PARAMETROS_BASE): Simulacion {
  const monto = aUnidades(montoUsd);
  const n = Math.max(1, Math.floor(cuotas));
  // Garantía mínima en unidades enteras (hacia arriba), como exige el LTV.
  const garantia = (monto * BPS + BigInt(p.max_ltv_bps) - BigInt(1)) / BigInt(p.max_ltv_bps);
  const comision = (monto * BigInt(p.origination_fee_bps)) / BPS;
  const porCuota = monto / BigInt(n);

  let saldo = monto;
  let pagado = BigInt(0);
  let liberadaAnt = BigInt(0);
  let interesTotal = BigInt(0);
  const calendario: CuotaSimulada[] = [];
  for (let k = 1; k <= n; k++) {
    const interes = (saldo * BigInt(p.rate_bps)) / BPS / BigInt(12);
    const capital = k === n ? saldo : porCuota;
    saldo -= capital;
    pagado += capital;
    const liberadaAcum = k === n ? garantia : (pagado * garantia) / monto;
    calendario.push({
      numero: k,
      capital: aUsd(capital),
      interes: aUsd(interes),
      total: aUsd(capital + interes),
      saldoDespues: aUsd(saldo),
      garantiaLiberada: aUsd(liberadaAcum - liberadaAnt),
      garantiaLiberadaAcumulada: aUsd(liberadaAcum),
    });
    liberadaAnt = liberadaAcum;
    interesTotal += interes;
  }

  const costo = interesTotal + comision;
  return {
    monto: aUsd(monto),
    cuotas: n,
    garantia: aUsd(garantia),
    comision: aUsd(comision),
    recibes: aUsd(monto - comision),
    interesTotal: aUsd(interesTotal),
    totalPagado: aUsd(monto + interesTotal),
    costoNeto: aUsd(costo),
    costoNetoPct: monto > BigInt(0) ? Number((costo * BigInt(10_000)) / monto) / 100 : 0,
    calendario,
  };
}

/** Formato de montos en USDC para mostrar (es-BO). */
export function fmt(n: number, decimales = 2): string {
  return new Intl.NumberFormat("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: decimales }).format(n);
}

export { U as UNIDAD };
