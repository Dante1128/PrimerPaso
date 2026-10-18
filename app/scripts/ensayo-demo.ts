// Ensayo automático de la demo contra la app corriendo (npm run dev) y
// Stellar Testnet. Recorre el flujo completo por la API, firmando con las
// llaves de las wallets de demo como lo haría Freighter, y escribe el
// registro con los enlaces a stellar.expert en docs/ensayo-demo.md.
//
// Uso (desde app/, con la app levantada):
//   LUCIA_SECRET=$(stellar keys show primerpaso-demo-lucia) \
//   ROSA_SECRET=$(stellar keys show primerpaso-demo-rosa) \
//   npm run demo:ensayo
//
// Las llaves solo se leen de variables de entorno; nunca se escriben.
import { writeFileSync } from "node:fs";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const PASS = process.env.SEED_PASSWORD ?? "PrimerPaso2026!";
const lucia = Keypair.fromSecret(requerido("LUCIA_SECRET"));
const rosa = Keypair.fromSecret(requerido("ROSA_SECRET"));

function requerido(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta ${nombre} (ver el uso al inicio del archivo)`);
  return v;
}

type Resp = { status: number; error?: string; link?: string; [k: string]: unknown };

/** Cliente HTTP con cookies de sesión, como un navegador. */
function sesion() {
  const cookies = new Map<string, string>();
  return async (ruta: string, body?: unknown, method?: string): Promise<Resp> => {
    const res = await fetch(BASE + ruta, {
      method: method ?? (body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    for (const c of res.headers.getSetCookie()) {
      const kv = c.split(";")[0];
      const i = kv.indexOf("=");
      cookies.set(kv.slice(0, i), kv.slice(i + 1));
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, ...data };
  };
}

const firmar = (xdr: string, kp: Keypair) => {
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  tx.sign(kp);
  return tx.toXDR();
};

const registro: string[] = [];
let n = 0;
function paso(titulo: string, r: Resp, detalle = "") {
  n++;
  const ok = r.status < 400 && !r.error;
  const linea = `| ${n} | ${ok ? "✅" : "❌"} ${titulo}${detalle ? ` — ${detalle}` : ""} | ${r.link ? `[ver tx](${r.link})` : r.error ?? ""} |`;
  registro.push(linea);
  console.log(`${ok ? "✓" : "✗"} ${titulo} ${detalle} ${r.link ?? r.error ?? ""}`);
  if (!ok) throw new Error(`Falló: ${titulo} → ${r.error}`);
  return r;
}

async function main() {
  const L = sesion(), R = sesion(), O = sesion(), A = sesion();
  await L("/api/auth/login", { email: "lucia@primerpaso.test", password: PASS });
  await R("/api/auth/login", { email: "rosa@primerpaso.test", password: PASS });
  await O("/api/auth/login", { email: "operador@primerpaso.test", password: PASS });
  await A("/api/auth/login", { email: "admin@primerpaso.test", password: PASS });

  // Si un ensayo anterior quedó a medias, se reanuda desde los pagos.
  const previos = (await L("/api/loans/status")) as Resp & { prestamos?: { onchain_loan_id: number; status: string }[] };
  const activo = previos.prestamos?.find((p) => p.status === "active");
  const loanId = activo ? activo.onchain_loan_id : await abrirPrestamo(L, R, O);
  if (activo) registro.push(`| — | ↪️ Reanudado: Lucía ya tenía el préstamo #${loanId} activo | |`);

  await pagarHastaSaldar(L, loanId);
  await cierre(A, loanId);
}

type Cliente = ReturnType<typeof sesion>;

/** Pasos 1–6: wallet, garante, KYC, solicitud, garantía y apertura. */
async function abrirPrestamo(L: Cliente, R: Cliente, O: Cliente): Promise<number> {
  // 1. Lucía vincula su wallet con SEP-10.
  const ch = await L(`/api/sep10/challenge?account=${lucia.publicKey()}`);
  paso("Lucía vincula su wallet (SEP-10)", await L("/api/sep10/token", { signedXdr: firmar(String(ch.challenge), lucia) }));

  // 2. Lucía invita a Rosa como garante; Rosa acepta con el código.
  const inv = paso("Lucía invita a Rosa como garante", await L("/api/invitations", { guarantorEmail: "rosa@primerpaso.test" }));
  paso("Rosa acepta con el código", await R("/api/auth/role", { role: "guarantor", invitationCode: inv.code }), `código ${inv.code}`);

  // 3. El operador aprueba el KYC de Lucía.
  const kyc = (await O("/api/kyc/review")) as Resp & { kyc?: { id: string; profile?: { full_name: string } }[] };
  const kycLucia = kyc.kyc?.find((k) => k.profile?.full_name === "Lucía Fernández");
  if (kycLucia) paso("Operador aprueba el KYC de Lucía", await O("/api/kyc/review", { id: kycLucia.id, decision: "approve" }));

  // 4. Lucía solicita 300 USDC en 3 cuotas para un curso; el operador aprueba.
  const sol = paso(
    "Lucía solicita 300 USDC en 3 cuotas",
    await L("/api/applications", { amountUsd: 300, installments: 3, purpose: "course", purposeDetail: "Curso de modelado 3D" }),
  );
  const s = sol.solicitud as { id: string; collateral_amount: number };
  paso("Operador aprueba la solicitud", await O("/api/applications/review", { id: s.id, decision: "approve" }), `garantía ${s.collateral_amount} USDC`);

  // 5. Rosa (garante) bloquea la garantía desde su wallet.
  const dep = await R("/api/loans/prepare", { applicationId: s.id, step: "deposit" });
  paso(
    "Rosa bloquea la garantía",
    await R("/api/loans/submit", { applicationId: s.id, step: "deposit", signedXdr: firmar(String(dep.xdr), rosa) }),
    `${dep.monto} USDC`,
  );

  // 6. Lucía firma la apertura (PrimerPaso co-firma como operator) y recibe el dinero.
  const ab = await L("/api/loans/prepare", { applicationId: s.id, step: "open" });
  const abierto = paso(
    "Lucía firma y recibe el préstamo",
    await L("/api/loans/submit", { applicationId: s.id, step: "open", signedXdr: firmar(String(ab.xdr), lucia) }),
    "recibe 297 USDC (comisión 1%)",
  );
  return Number(abierto.loanId);
}

/** 7. Lucía paga cuota por cuota hasta saldar; cada pago libera 125 USDC a Rosa. */
async function pagarHastaSaldar(L: Cliente, loanId: number) {
  for (let k = 1; k <= 12; k++) {
    const est = (await L(`/api/loans/status?loanId=${loanId}`)) as Resp & {
      prestamo?: { status: string };
      cadena?: { cuotasPagadas: number };
    };
    if (est.prestamo?.status !== "active") break;
    const cuota = (est.cadena?.cuotasPagadas ?? 0) + 1;
    const pp = await L("/api/payments/prepare", { loanId });
    paso(
      `Lucía paga la cuota ${cuota}`,
      await L("/api/payments/submit", { loanId, signedXdr: firmar(String(pp.xdr), lucia) }),
      `${pp.total} USDC (capital ${pp.capital} + interés ${pp.interes})`,
    );
  }
}

/** 8–10: saldo final, verificador, liquidación en vivo y resumen del admin. */
async function cierre(A: Cliente, loanId: number) {
  const L = sesion();
  await L("/api/auth/login", { email: "lucia@primerpaso.test", password: PASS });
  const st = (await L(`/api/loans/status?loanId=${loanId}`)) as Resp & {
    prestamo?: { status: string };
    cadena?: { garantiaLiberada: number };
  };
  paso("Préstamo saldado y garantía devuelta a Rosa", st, `estado ${st.prestamo?.status}, liberado ${st.cadena?.garantiaLiberada} USDC`);

  // 8. Credencial on-chain visible en el verificador público.
  const v = await fetch(`${BASE}/verificar/${lucia.publicKey()}`).then((r) => r.text());
  paso("Verificador público muestra la credencial", { status: v.includes("Buen pagador") ? 200 : 500 }, `/verificar/${lucia.publicKey()}`);

  // 9. Liquidación en vivo de un préstamo en mora (si hay alguno).
  const liq = (await A("/api/liquidations")) as Resp & { prestamos?: { onchain_loan_id: number; liquidable: boolean }[] };
  const enMora = liq.prestamos?.find((p) => p.liquidable);
  if (enMora) {
    paso(`Admin liquida el préstamo #${enMora.onchain_loan_id} (en mora)`, await A("/api/liquidations", { loanId: enMora.onchain_loan_id }));
  } else {
    registro.push(`| ${++n} | ⏭️ Liquidación: no había préstamos en mora en ese momento | |`);
  }

  // 10. Resumen del admin.
  const ov = (await A("/api/admin/overview")) as Resp & {
    pool?: { disponibleParaPrestar: number };
    ingresos?: { total: number; interes: number; originacion: number; recargos: number };
  };
  paso(
    "Admin ve pool e ingresos",
    ov,
    `pool ${ov.pool?.disponibleParaPrestar} USDC · ingresos ${ov.ingresos?.total?.toFixed(2)} (interés ${ov.ingresos?.interes?.toFixed(2)}, comisiones ${ov.ingresos?.originacion?.toFixed(2)}, recargos ${ov.ingresos?.recargos?.toFixed(2)})`,
  );

  const md = `# Ensayo de la demo (automático)

Ejecutado el ${new Date().toLocaleString("es-BO")} contra Stellar **Testnet** con \`npm run demo:ensayo\`.
Cada transacción se puede abrir en stellar.expert.

| # | Paso | Transacción |
|---|---|---|
${registro.join("\n")}

- Wallet de Lucía (estudiante): \`${lucia.publicKey()}\` — [verificador](${BASE}/verificar/${lucia.publicKey()})
- Wallet de Rosa (garante): \`${rosa.publicKey()}\`
`;
  writeFileSync(new URL("../../docs/ensayo-demo.md", import.meta.url), md);
  console.log("\nRegistro guardado en docs/ensayo-demo.md");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
