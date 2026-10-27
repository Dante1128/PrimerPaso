// Solicitudes de préstamo.
//  GET  → estudiante: las suyas · garante: las que respalda · staff: todas (?status=)
//  POST → el estudiante crea una solicitud (queda "submitted").
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirUsuario, manejar, ErrorApi, auditar, periodoSegundos } from "@/lib/api";
import { solicitudSchema } from "@/lib/validation";
import type { Enums, Tables } from "@/lib/database.types";
import { posicionDeSolicitud } from "@/lib/prestamos";
import { leerPosicion } from "@/lib/soroban";

const CAMPOS =
  "id, student_id, guarantor_id, purpose, purpose_detail, amount_usd, collateral_amount, rate_bps, installments, status, rejection_reason, created_at, updated_at, student:profiles!loan_applications_student_id_fkey(full_name), guarantor:profiles!loan_applications_guarantor_id_fkey(full_name)";

export const GET = manejar(async (req: Request) => {
  const user = await exigirUsuario();
  let q = supabaseAdmin().from("loan_applications").select(CAMPOS).order("created_at", { ascending: false });

  if (user.role === "student") q = q.eq("student_id", user.id);
  else if (user.role === "guarantor") q = q.eq("guarantor_id", user.id);
  else {
    const status = new URL(req.url).searchParams.get("status");
    if (status) q = q.eq("status", status as Enums<"application_status">);
  }
  const { data, error } = await q;
  if (error) throw new ErrorApi(error.message, 500);
  // En las aprobadas, ¿ya se depositó la garantía? (posición on-chain abierta)
  const solicitudes = await Promise.all(
    (data ?? []).map(async (s) => {
      if (s.status !== "approved") return { ...s, posicion: null, garantiaDepositada: false };
      const posicion = await posicionDeSolicitud(s as unknown as Tables<"loan_applications">);
      const p = posicion ? await leerPosicion(posicion).catch(() => null) : null;
      return { ...s, posicion, garantiaDepositada: p?.status === "Open" };
    }),
  );
  // Duración de cada cuota, para que el estudiante sepa cuándo paga antes de firmar.
  return Response.json({ solicitudes, periodoSegundos: periodoSegundos() });
});

export const POST = manejar(async (req: Request) => {
  const user = await exigirUsuario(["student"]);
  if (!user.wallet) throw new ErrorApi("Primero vincula tu wallet");
  if (user.kycStatus === "rejected") throw new ErrorApi("Tu verificación de identidad fue rechazada");

  const parsed = solicitudSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ErrorApi(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const d = parsed.data;

  const db = supabaseAdmin();
  const { data: s } = await db.from("platform_settings").select("*").eq("id", true).single();
  if (!s) throw new ErrorApi("Parámetros no disponibles", 500);
  if (d.amountUsd < Number(s.min_amount_usd) || d.amountUsd > Number(s.max_amount_usd)) {
    throw new ErrorApi(`El monto debe estar entre ${Number(s.min_amount_usd)} y ${Number(s.max_amount_usd)} USDC`);
  }
  if (d.installments > s.max_installments) throw new ErrorApi(`Máximo ${s.max_installments} cuotas`);

  // Una solicitud en curso a la vez.
  const { count } = await db
    .from("loan_applications")
    .select("id", { count: "exact", head: true })
    .eq("student_id", user.id)
    .in("status", ["draft", "submitted", "approved"]);
  if (count) throw new ErrorApi("Ya tienes una solicitud en curso");

  // Garante vinculado (invitación aceptada), si existe.
  const { data: inv } = await db
    .from("guarantor_invitations")
    .select("guarantor_id")
    .eq("student_id", user.id)
    .eq("status", "accepted")
    .not("guarantor_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Garantía necesaria = monto / LTV, redondeada hacia arriba a centavos.
  const garantia = Math.ceil(((d.amountUsd * 10_000) / s.max_ltv_bps) * 100) / 100;

  const { data, error } = await db
    .from("loan_applications")
    .insert({
      student_id: user.id,
      guarantor_id: inv?.guarantor_id ?? null,
      purpose: d.purpose,
      purpose_detail: d.purposeDetail || null,
      amount_usd: d.amountUsd,
      collateral_amount: garantia,
      asset_contract_id: process.env.NEXT_PUBLIC_USDC_CONTRACT_ID ?? "",
      rate_bps: s.rate_bps,
      installments: d.installments,
      status: "submitted",
    })
    .select("id, amount_usd, collateral_amount, installments, status")
    .single();
  if (error) throw new ErrorApi(error.message, 500);
  await auditar(user.id, "application_submitted", "loan_application", data.id, d);
  return Response.json({ ok: true, solicitud: data });
});
