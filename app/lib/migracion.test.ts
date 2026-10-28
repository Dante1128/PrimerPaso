import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table profiles(id uuid primary key);
    create table indexer_state(contract_id text primary key);
    create table loan_applications(
      id int primary key, student_id uuid not null references profiles(id), status text not null,
      installments int not null,
      constraint loan_applications_installments_check check (installments between 1 and 24)
    );
    insert into profiles values ('00000000-0000-4000-8000-000000000001');
  `);
  await db.exec(readFileSync(new URL("../../supabase/migrations/0005_consistencia.sql", import.meta.url), "utf8"));
}, 30_000);
afterAll(async () => { await db.close(); });

it("la migración admite hasta 60 cuotas", async () => {
  await db.exec("insert into loan_applications values(1, '00000000-0000-4000-8000-000000000001', 'rejected', 60)");
  await expect(db.exec("insert into loan_applications values(2, '00000000-0000-4000-8000-000000000001', 'rejected', 61)")).rejects.toThrow();
});

it("dos inserciones simultáneas solo pueden crear una solicitud en curso", async () => {
  const resultados = await Promise.allSettled([10, 11].map((id) => db.exec(`insert into loan_applications values(${id}, '00000000-0000-4000-8000-000000000001', 'submitted', 10)`)));
  expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(resultados.filter((r) => r.status === "rejected")).toHaveLength(1);
  const filas = await db.query<{ count: number }>("select count(*)::int as count from loan_applications where status='submitted'");
  expect(filas.rows[0].count).toBe(1);
});

it("los clientes autenticados no pueden escribir transacciones preparadas", async () => {
  await db.exec("set role authenticated");
  try {
    await expect(db.exec("insert into prepared_transactions(tx_hash,profile_id,entity_id,method,expires_at) values ('hash','00000000-0000-4000-8000-000000000001','solicitud','open_loan',now())")).rejects.toThrow("permission denied");
  } finally { await db.exec("reset role"); }
});
