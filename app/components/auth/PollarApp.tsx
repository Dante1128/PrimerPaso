"use client";
// Envoltorio del SDK de Pollar (login social + wallet embebida). Solo se
// monta en /registro y /panel: el resto del sitio es estático y no lo
// necesita (montarlo en el layout raíz rompe el prerender de esas páginas).
import { PollarProvider } from "@pollar/react";

export default function PollarApp({ children }: { children: React.ReactNode }) {
  return (
    <PollarProvider
      client={{
        apiKey: process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY!,
        stellarNetwork: process.env.NEXT_PUBLIC_STELLAR_NETWORK === "PUBLIC" ? "mainnet" : "testnet",
      }}
    >
      {children}
    </PollarProvider>
  );
}
