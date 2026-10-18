// Datos de prueba (seed) de PrimerPaso en Supabase.
//
// Crea 1 admin, 1 operator, 2 estudiantes (con universidad y carrera) y
// 1 garante; registra el fondeo de 100.000 USDC del pool y deja
// platform_settings igual a los parámetros del contrato desplegado.
// Es idempotente: se puede correr varias veces.
//
// Uso (desde app/):  npm run db:seed
// Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret?.startsWith("sb_secret_")) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (sb_secret_...) en .env.local");
}
const db = createClient<Database>(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Contraseña de todas las cuentas de prueba. */
const PASSWORD = process.env.SEED_PASSWORD ?? "PrimerPaso2026!";

/** Estudiante de demo con préstamo #1 abierto on-chain (ver docs/despliegue-testnet.md). */
const WALLET_DEMO = "GBSAUPHFJT526CUAYIF3ZQ6JDP3OKPFJF3UU5QOHAPADYYVTUFK3L5O5";
/** Wallets de demo de María (estudiante) y Rosa (garante). */
const WALLET_MARIA = "GALCQAJOMCDUNO5LVI3V7Q2YRPBS6BSY6AOBRBDBLEML2TSCTU5PBBUO";
const WALLET_ROSA = "GCA3XRLVWB6JQVPOJ47W6A7XDA4QJ4M5RT6HNXWM4APZBZWISNHFTHYT";
const WALLET_ANA = "GD76NSZC47HPTTUGDRPGMKEI4B24OMCRPZZJGHHHR5E7BNIWND7BLRTL";
/** Ledger anterior al despliegue: el indexador arranca desde aquí. */
const LEDGER_DESPLIEGUE = 5_253_700;

type Rol = Database["public"]["Enums"]["user_role"];

async function check<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, que: string) {
  const { data, error } = await p;
  if (error) throw new Error(`${que}: ${error.message}`);
  return data;
}

async function usuario(email: string, fullName: string, role: Rol): Promise<string> {
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let id = data.users.find((u) => u.email === email)?.id;
  if (!id) {
    const creado = await db.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (creado.error) throw new Error(`crear ${email}: ${creado.error.message}`);
    id = creado.data.user.id;
  }
  await check(
    db.from("profiles").upsert({ id, full_name: fullName, role }, { onConflict: "id" }),
    `perfil ${email}`,
  );
  console.log(`  ${role.padEnd(9)} ${email}`);
  return id;
}

/** Inserta solo si no existe una fila que cumpla `filtro`. */
async function insertarSiFalta<T extends keyof Database["public"]["Tables"]>(
  tabla: T,
  filtro: Record<string, string | number | boolean>,
  fila: Database["public"]["Tables"][T]["Insert"],
) {
  let q = db.from(tabla).select("*", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v as never);
  const { count, error } = await q;
  if (error) throw new Error(`${tabla}: ${error.message}`);
  if (!count) await check(db.from(tabla).insert(fila as never), `insertar en ${tabla}`);
}

async function main() {
  console.log("Usuarios:");
  const admin = await usuario("admin@primerpaso.test", "Admin PrimerPaso", "admin");
  await usuario("operador@primerpaso.test", "Operador PrimerPaso", "operator");
  const carlos = await usuario("carlos@primerpaso.test", "Carlos Mamani", "student");
  const maria = await usuario("maria@primerpaso.test", "María Quispe", "student");
  const rosa = await usuario("rosa@primerpaso.test", "Rosa Quispe", "guarantor");
  // Estudiantes extra: Lucía (KYC pendiente) y Ana (lista para pedir un préstamo).
  const lucia = await usuario("lucia@primerpaso.test", "Lucía Fernández", "student");
  const ana = await usuario("ana@primerpaso.test", "Ana Rojas", "student");

  console.log("Perfiles universitarios, KYC y wallets…");
  await check(
    db.from("student_profiles").upsert(
      [
        { profile_id: carlos, university_name: "Universidad Privada Boliviana (UPB)", career: "Ingeniería de Sistemas", student_code: "UPB-2023-0142", semester: 5 },
        { profile_id: maria, university_name: "Universidad Mayor de San Andrés (UMSA)", career: "Economía", student_code: "UMSA-2024-0871", semester: 3 },
        { profile_id: lucia, university_name: "Universidad Católica Boliviana (UCB)", career: "Arquitectura", student_code: "UCB-2023-0533", semester: 6 },
        { profile_id: ana, university_name: "Universidad Mayor de San Simón (UMSS)", career: "Medicina", student_code: "UMSS-2025-1290", semester: 2 },
      ],
      { onConflict: "profile_id" },
    ),
    "student_profiles",
  );

  const ahora = new Date().toISOString();
  await insertarSiFalta("kyc_submissions", { profile_id: carlos }, {
    profile_id: carlos,
    status: "approved",
    sep12_fields: { first_name: "Carlos", last_name: "Mamani", id_country_code: "BOL" },
    document_paths: [],
    reviewed_by: admin,
    reviewed_at: ahora,
  });
  await insertarSiFalta("kyc_submissions", { profile_id: maria }, {
    profile_id: maria,
    status: "pending",
    sep12_fields: { first_name: "María", last_name: "Quispe", id_country_code: "BOL" },
    document_paths: [],
  });

  // Carlos usa la wallet de demo que ya tiene el préstamo #1 on-chain.
  await insertarSiFalta("wallets", { address: WALLET_DEMO }, {
    profile_id: carlos,
    address: WALLET_DEMO,
    sep10_verified_at: ahora,
    is_primary: true,
  });

  // María y Rosa (garante) también tienen wallets de testnet con USDC de prueba.
  await insertarSiFalta("wallets", { address: WALLET_MARIA }, {
    profile_id: maria,
    address: WALLET_MARIA,
    sep10_verified_at: ahora,
    is_primary: true,
  });
  await insertarSiFalta("wallets", { address: WALLET_ROSA }, {
    profile_id: rosa,
    address: WALLET_ROSA,
    sep10_verified_at: ahora,
    is_primary: true,
  });
  await insertarSiFalta("kyc_submissions", { profile_id: rosa }, {
    profile_id: rosa,
    status: "approved",
    sep12_fields: { first_name: "Rosa", last_name: "Quispe", id_country_code: "BOL" },
    document_paths: [],
    reviewed_by: admin,
    reviewed_at: ahora,
  });

  // Lucía: KYC pendiente.
  await insertarSiFalta("kyc_submissions", { profile_id: lucia }, {
    profile_id: lucia,
    status: "pending",
    sep12_fields: { first_name: "Lucía", last_name: "Fernández", id_number: "7845123", id_country_code: "BOL", birth_date: "2004-03-12" },
    document_paths: [],
  });
  // Ana: lista para la demo en vivo (KYC aprobado y wallet con USDC de prueba).
  await insertarSiFalta("kyc_submissions", { profile_id: ana }, {
    profile_id: ana,
    status: "approved",
    sep12_fields: { first_name: "Ana", last_name: "Rojas", id_country_code: "BOL" },
    document_paths: [],
    reviewed_by: admin,
    reviewed_at: ahora,
  });
  await insertarSiFalta("wallets", { address: WALLET_ANA }, {
    profile_id: ana,
    address: WALLET_ANA,
    sep10_verified_at: ahora,
    is_primary: true,
  });

  // Rosa ya aceptó ser garante de María.
  await insertarSiFalta("guarantor_invitations", { student_id: maria, guarantor_id: rosa }, {
    student_id: maria,
    guarantor_email: "rosa@primerpaso.test",
    guarantor_id: rosa,
    status: "accepted",
  });

  console.log("Pool y parámetros…");
  await insertarSiFalta("pool_movements", { type: "fund" }, {
    type: "fund",
    amount: 100_000,
    note: "Fondeo inicial de la treasury en testnet (USDC de prueba)",
  });

  // platform_settings debe coincidir con loan.get_params() del despliegue.
  await check(
    db.from("platform_settings").update({
      max_ltv_bps: 8000,
      rate_bps: 800,
      origination_fee_bps: 100,
      late_fee_bps: 200,
      yield_share_platform_bps: 2500,
      grace_seconds: 120,
      min_amount_usd: 100,
      max_amount_usd: 3000,
      max_installments: 12,
      updated_at: ahora,
    }).eq("id", true),
    "platform_settings",
  );

  // Punto de partida del indexador para los dos contratos.
  const contratos = [process.env.NEXT_PUBLIC_LOAN_CONTRACT_ID, process.env.NEXT_PUBLIC_HISTORY_CONTRACT_ID];
  for (const contract_id of contratos) {
    if (contract_id) {
      await insertarSiFalta("indexer_state", { contract_id }, { contract_id, last_ledger: LEDGER_DESPLIEGUE });
    }
  }

  console.log(`Listo. Contraseña de las cuentas de prueba: ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
