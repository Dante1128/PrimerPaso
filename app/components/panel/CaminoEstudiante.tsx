// Camino del estudiante: en qué paso está y qué le toca hacer ahora.
import { caminoEstudiante, type DatosCamino, type EstadoPaso } from "@/lib/camino";

const ESTILO: Record<EstadoPaso, { circulo: string; texto: string; marca?: string }> = {
  hecho: { circulo: "bg-lime", texto: "text-ink", marca: "✓" },
  actual: { circulo: "bg-sun", texto: "font-bold text-ink" },
  revision: { circulo: "bg-azure/40", texto: "text-ink", marca: "…" },
  pendiente: { circulo: "bg-white", texto: "text-ink/50" },
};

export default function CaminoEstudiante({ datos }: { datos: DatosCamino }) {
  const { pasos, ahora } = caminoEstudiante(datos);
  return (
    <section className="nb-card p-5 sm:p-6" aria-label="Tu camino">
      <ol className="flex items-start">
        {pasos.map((p, i) => {
          const e = ESTILO[p.estado];
          return (
            <li key={p.id} className="flex flex-1 items-start">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 border-ink text-sm font-bold text-ink ${e.circulo}`}
                  aria-hidden="true"
                >
                  {e.marca ?? i + 1}
                </span>
                <span className={`text-[11px] sm:text-xs ${e.texto}`}>
                  {p.txt}
                  {p.estado === "revision" && <span className="block text-[10px] text-ink/60">en revisión</span>}
                </span>
              </div>
              {i < pasos.length - 1 && (
                <span className={`mt-4 h-0.5 flex-1 ${p.estado === "hecho" ? "bg-ink" : "bg-ink/20"}`} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 rounded-xl border-2 border-ink bg-cream px-4 py-3 text-sm text-ink">
        <span className="font-bold">Ahora: </span>
        {ahora}
      </p>
    </section>
  );
}
