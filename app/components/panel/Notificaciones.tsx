"use client";
// Campana de avisos: qué pasó con tu identidad, tu solicitud o tu préstamo, y qué hacer.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/cliente";
import { fecha } from "@/components/panel/comunes";
import { textoAviso } from "@/lib/avisos";

type Notificacion = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export default function Notificaciones() {
  const [lista, setLista] = useState<Notificacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const cargar = useCallback(() => {
    api<{ notificaciones: Notificacion[] }>("/api/notifications").then(
      (d) => setLista(d.notificaciones),
      () => {},
    );
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const sinLeer = lista.filter((n) => !n.read_at).length;

  function alternar() {
    const abrir = !abierto;
    setAbierto(abrir);
    if (abrir && sinLeer > 0) {
      api("/api/notifications", {}, "PATCH").then(
        () => setLista((l) => l.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))),
        () => {},
      );
    }
  }

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-label={sinLeer ? `Avisos: ${sinLeer} sin leer` : "Avisos"}
        className="relative grid h-9 w-9 place-items-center rounded-full border-2 border-ink bg-white text-ink transition hover:bg-cream"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {sinLeer > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-coral px-1 text-[10px] font-bold text-white">
            {sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-ink bg-white p-2 nb-shadow">
          <p className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-ink/50">Avisos</p>
          {lista.length === 0 ? (
            <p className="px-2 py-4 text-sm text-ink/60">Todavía no tienes avisos.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-ink/10 overflow-y-auto">
              {lista.map((n) => (
                <li key={n.id} className={`px-2 py-2.5 text-sm ${n.read_at ? "text-ink/70" : "font-semibold text-ink"}`}>
                  <p>{textoAviso(n)}</p>
                  <p className="mt-0.5 text-xs font-normal text-ink/50">{fecha(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
