"use client";
// Widget de Cloudflare Turnstile. Si NEXT_PUBLIC_TURNSTILE_SITE_KEY está
// vacía no se muestra nada y los formularios no piden CAPTCHA (testnet).
// Cada token sirve una sola vez: para pedir otro, cambia el `key` del componente.
import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const CAPTCHA_ACTIVO = Boolean(SITE_KEY);

type Api = {
  render: (el: HTMLElement, o: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Api;
  }
}

let cargando: Promise<Api> | null = null;
function cargarScript(): Promise<Api> {
  cargando ??= new Promise((ok, falla) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => (window.turnstile ? ok(window.turnstile) : falla(new Error("Turnstile no cargó")));
    s.onerror = () => {
      cargando = null;
      falla(new Error("Turnstile no cargó"));
    };
    document.head.appendChild(s);
  });
  return cargando;
}

export default function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const alToken = useRef(onToken);
  useEffect(() => {
    alToken.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!CAPTCHA_ACTIVO) return;
    let id: string | null = null;
    let vivo = true;
    cargarScript()
      .then((t) => {
        if (!vivo || !caja.current) return;
        id = t.render(caja.current, {
          sitekey: SITE_KEY,
          language: "es",
          callback: (token: string) => alToken.current(token),
          "expired-callback": () => alToken.current(""),
          "error-callback": () => alToken.current(""),
        });
      })
      .catch(() => alToken.current(""));
    return () => {
      vivo = false;
      if (id) window.turnstile?.remove(id);
    };
  }, []);

  if (!CAPTCHA_ACTIVO) return null;
  return <div ref={caja} className="min-h-[65px]" />;
}
