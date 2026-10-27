"use client";
// Herramientas del operador: revisión de KYC y de solicitudes.
// El admin también las usa (desde sus pestañas).

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/cliente";
import { Alerta, Boton, Spinner } from "@/components/ui";
import { Estado, PROPOSITOS, Tarjeta, Vacio, fecha, usdc } from "@/components/panel/comunes";
import type { Solicitud } from "@/components/panel/PanelEstudiante";

type Kyc = {
  id: string;
  created_at: string;
  sep12_fields: Record<string, string>;
  profile: { full_name: string | null; role: string } | null;
  documentos: { path: string; url: string | null }[];
};

/** Decisión con motivo obligatorio al rechazar. */
async function decidir(url: string, id: string, decision: "approve" | "reject") {
  let reason: string | undefined;
  if (decision === "reject") {
    reason = window.prompt("Motivo del rechazo (lo verá el usuario):")?.trim();
    if (!reason) return false;
  }
  await api(url, { id, decision, reason });
  return true;
}

export function RevisionKyc() {
  const [lista, setLista] = useState<Kyc[] | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState("");

  const cargar = useCallback(() => {
    api<{ kyc: Kyc[] }>("/api/kyc/review")
      .then((d) => setLista(d.kyc))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function accion(id: string, d: "approve" | "reject") {
    setError("");
    setOcupado(id);
    try {
      if (await decidir("/api/kyc/review", id, d)) cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado("");
    }
  }

  return (
    <Tarjeta titulo="Verificaciones de identidad pendientes" accion={<Boton variant="ghost" onClick={cargar}>Actualizar</Boton>}>
      {error && <Alerta tipo="error">{error}</Alerta>}
      {!lista ? (
        <Spinner className="h-5 w-5 text-ink/40" />
      ) : lista.length === 0 ? (
        <Vacio>No hay KYC pendientes.</Vacio>
      ) : (
        <ul className="space-y-3">
          {lista.map((k) => (
            <li key={k.id} className="rounded-xl border-2 border-ink p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-semibold text-ink">
                    {k.profile?.full_name}{" "}
                    <span className="text-xs font-normal text-ink/50">({k.profile?.role === "guarantor" ? "garante" : "estudiante"})</span>
                  </p>
                  <p className="text-ink/70">
                    {k.sep12_fields.first_name} {k.sep12_fields.last_name} · CI {k.sep12_fields.id_number ?? "—"} · nac.{" "}
                    {k.sep12_fields.birth_date ?? "—"}
                  </p>
                  <p className="text-xs text-ink/50">Enviado {fecha(k.created_at)}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {k.documentos.length === 0 && <span className="text-xs text-ink/50">Sin documentos</span>}
                    {k.documentos.map((d) => (
                      <a
                        key={d.path}
                        href={d.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-brandink hover:underline"
                      >
                        {d.path.split("/").pop()?.split("-")[0] === "selfie" ? "Selfie" : "Carnet"} ↗
                      </a>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Boton onClick={() => accion(k.id, "approve")} disabled={!!ocupado}>
                    {ocupado === k.id && <Spinner />} Aprobar
                  </Boton>
                  <Boton variant="secondary" onClick={() => accion(k.id, "reject")} disabled={!!ocupado}>
                    Rechazar
                  </Boton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

export function RevisionSolicitudes() {
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState("");

  const cargar = useCallback(() => {
    api<{ solicitudes: Solicitud[] }>("/api/applications")
      .then((d) => setLista(d.solicitudes))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function accion(id: string, d: "approve" | "reject") {
    setError("");
    setOcupado(id);
    try {
      if (await decidir("/api/applications/review", id, d)) cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado("");
    }
  }

  const pendientes = lista?.filter((s) => s.status === "submitted") ?? [];
  const aprobadas = lista?.filter((s) => s.status === "approved") ?? [];
  const resto = lista?.filter((s) => !["submitted", "approved"].includes(s.status)).slice(0, 10) ?? [];

  return (
    <div className="space-y-4">
      <Tarjeta titulo="Solicitudes por revisar" accion={<Boton variant="ghost" onClick={cargar}>Actualizar</Boton>}>
        {error && <Alerta tipo="error">{error}</Alerta>}
        {!lista ? (
          <Spinner className="h-5 w-5 text-ink/40" />
        ) : pendientes.length === 0 ? (
          <Vacio>No hay solicitudes pendientes.</Vacio>
        ) : (
          <ul className="space-y-3">
            {pendientes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ink p-4">
                <div className="text-sm">
                  <p className="font-semibold text-ink">
                    {s.student?.full_name} · {usdc(s.amount_usd)} en {s.installments} cuotas
                  </p>
                  <p className="text-ink/70">
                    {PROPOSITOS[s.purpose]}
                    {s.purpose_detail ? ` — ${s.purpose_detail}` : ""} · garantía {usdc(s.collateral_amount)}
                    {s.guarantor?.full_name ? ` · garante: ${s.guarantor.full_name}` : ""}
                  </p>
                  <p className="text-xs text-ink/50">{fecha(s.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <Boton onClick={() => accion(s.id, "approve")} disabled={!!ocupado}>
                    {ocupado === s.id && <Spinner />} Aprobar
                  </Boton>
                  <Boton variant="secondary" onClick={() => accion(s.id, "reject")} disabled={!!ocupado}>
                    Rechazar
                  </Boton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {aprobadas.length > 0 && (
        <Tarjeta titulo="Aprobadas: esperando garantía y firma del estudiante">
          <ul className="divide-y divide-ink/10 text-sm">
            {aprobadas.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-ink/80">
                  {s.student?.full_name} · {usdc(s.amount_usd)} ·{" "}
                  {s.garantiaDepositada ? "garantía bloqueada, falta la firma" : "falta bloquear la garantía"}
                </span>
                <Estado status={s.status} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink/50">
            Al firmar el estudiante, el servidor co-firma como operator y la treasury desembolsa.
          </p>
        </Tarjeta>
      )}

      {resto.length > 0 && (
        <Tarjeta titulo="Últimas decisiones">
          <ul className="divide-y divide-ink/10 text-sm">
            {resto.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-ink/80">
                  {s.student?.full_name} · {usdc(s.amount_usd)}
                  {s.rejection_reason ? ` · ${s.rejection_reason}` : ""}
                </span>
                <Estado status={s.status} />
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}

export default function PanelOperador({ nombre }: { nombre: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Hola, {nombre.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-ink/60">Revisa identidades y solicitudes. Al aprobar, el estudiante ya puede abrir su préstamo.</p>
      </div>
      <RevisionKyc />
      <RevisionSolicitudes />
    </div>
  );
}
