// Componentes compartidos por los paneles.

export function EstadoBadge({
  status,
  enMora,
}: {
  status: string;
  enMora?: boolean;
}) {
  if (enMora && status === "Active") {
    return (
      <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-600">
        En mora
      </span>
    );
  }
  const mapa: Record<string, { txt: string; clase: string }> = {
    Active: { txt: "Activo", clase: "bg-teal-50 text-teal-700" },
    Completed: { txt: "Completado", clase: "bg-emerald-50 text-emerald-700" },
    Liquidated: { txt: "Liquidado", clase: "bg-slate-100 text-slate-500" },
    Pending: { txt: "Pendiente", clase: "bg-amber-50 text-amber-700" },
  };
  const e = mapa[status] ?? { txt: status, clase: "bg-slate-100 text-slate-500" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.clase}`}>
      {e.txt}
    </span>
  );
}

export function ProgresoMini({
  released,
  total,
}: {
  released: string;
  total: string;
}) {
  const pct =
    BigInt(total) > BigInt(0)
      ? Number((BigInt(released) * BigInt(100)) / BigInt(total))
      : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>Garantía liberada</span>
        <span className="font-semibold text-emerald-600">{pct}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
