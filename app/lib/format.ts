// Utilidades de formato de montos. El USDC usa 7 decimales (stroops).
export const STROOPS = BigInt(10_000_000);

/** Convierte USDC (número) a stroops (bigint) para los contratos. */
export function usdcAStroops(usdc: number): bigint {
  // Redondeamos a 7 decimales.
  return BigInt(Math.round(usdc * 1e7));
}

/** Convierte stroops (bigint | string | number) a USDC (número). */
export function stroopsAUsdc(stroops: bigint | string | number): number {
  return Number(BigInt(stroops)) / 1e7;
}

/** Formatea un monto en USDC para mostrar. */
export function fmtUsdc(stroops: bigint | string | number): string {
  const n = stroopsAUsdc(stroops);
  return new Intl.NumberFormat("es-BO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
}

/** Acorta una dirección Stellar para mostrar: GABC…XYZ9. */
export function cortarDir(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}
