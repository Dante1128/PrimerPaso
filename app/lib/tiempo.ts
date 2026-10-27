// Duraciones en palabras ("5 minutos", "30 días") y cuentas regresivas ("1 h 45 min").

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Duración de un periodo (ej. cada cuota) en la unidad más natural. */
export function duracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 3600) return plural(Math.max(1, Math.round(s / 60)), "minuto", "minutos");
  if (s < 86_400) return plural(Math.round(s / 3600), "hora", "horas");
  const dias = Math.round(s / 86_400);
  if (dias === 30) return "1 mes";
  return plural(dias, "día", "días");
}

/** Tiempo que falta, corto y preciso (null si ya pasó). */
export function restante(ms: number): string | null {
  if (ms <= 0) return null;
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} días ${h % 24} h` : `${d} días`;
}
