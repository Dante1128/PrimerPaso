"use client";
// Si el saldo no alcanza para la garantía, ofrece USDC de prueba (solo testnet).
import { useState } from "react";
import { ES_TESTNET, fondearPrueba, type PasoFondeo } from "@/lib/cliente";
import { Alerta, Boton, Spinner } from "@/components/ui";
import { usdc } from "@/components/panel/comunes";

const PASOS: Record<PasoFondeo, string> = {
  xlm: "Activando tu cuenta en la red…",
  trust: "Habilitando USDC: aprueba en Freighter…",
  usdc: "Enviando 1.500 USDC de prueba…",
};

export default function ConseguirUsdc({
  wallet,
  saldo,
  necesario,
  onListo,
}: {
  wallet: string;
  saldo: number;
  necesario: number;
  onListo: () => void;
}) {
  const [paso, setPaso] = useState<PasoFondeo | null>(null);
  const [error, setError] = useState("");

  if (saldo >= necesario) return null;

  async function conseguir() {
    setError("");
    try {
      await fondearPrueba(wallet, (p, estado) => setPaso(estado === "haciendo" ? p : null));
      onListo();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPaso(null);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <Alerta tipo="info">
        Necesitas {usdc(necesario)} y en tu wallet tienes {usdc(saldo)}.
        {ES_TESTNET ? " Como es una red de prueba, puedes conseguir USDC gratis (no tiene valor real)." : ""}
      </Alerta>
      {ES_TESTNET && (
        <div className="flex flex-wrap items-center gap-3">
          <Boton variant="sun" onClick={conseguir} disabled={paso !== null}>
            {paso && <Spinner />} Conseguir USDC de prueba
          </Boton>
          {paso && <span className="text-sm text-ink/70">{PASOS[paso]}</span>}
        </div>
      )}
      {error && <Alerta tipo="error">{error}</Alerta>}
    </div>
  );
}
