// El admin edita los parámetros en % y minutos; el contrato los guarda en
// bps (1% = 100) y segundos. Aquí se convierte en los dos sentidos.

export const ESCALAS = {
  max_ltv_bps: 100,
  rate_bps: 100,
  origination_fee_bps: 100,
  late_fee_bps: 100,
  yield_share_platform_bps: 100,
  grace_seconds: 60,
  min_amount_usd: 1,
  max_amount_usd: 1,
  max_installments: 1,
} as const;

export type ClaveParametro = keyof typeof ESCALAS;
export type Parametros = Record<ClaveParametro, number>;

const claves = Object.keys(ESCALAS) as ClaveParametro[];

/** Del contrato (bps, segundos) a lo que ve el admin (%, minutos). */
export function paraEditar(p: Record<ClaveParametro, number | string>): Parametros {
  return Object.fromEntries(claves.map((k) => [k, Number(p[k]) / ESCALAS[k]])) as Parametros;
}

/** De lo que escribió el admin al contrato. bps y segundos son enteros. */
export function paraContrato(p: Parametros): Parametros {
  return Object.fromEntries(claves.map((k) => [k, ESCALAS[k] === 1 ? p[k] : Math.round(p[k] * ESCALAS[k])])) as Parametros;
}
