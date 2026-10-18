// Esquemas de validación (zod) para el registro y la autenticación.
import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Email inválido");

/** Creación de cuenta. */
export const registroSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "El nombre completo es obligatorio")
    .max(120, "Nombre demasiado largo"),
  email,
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(100, "Contraseña demasiado larga"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "La contraseña es obligatoria"),
});

/** Pedir un código de ingreso por email (sin contraseña). */
export const pedirCodigoSchema = z.object({ email });

export const verificarCodigoSchema = z.object({
  email,
  code: z
    .string()
    .trim()
    .regex(/^\d{6,8}$/, "El código debe tener 6 dígitos"),
});

export const rolSchema = z.object({
  role: z.enum(["student", "guarantor"], { error: "Elige un rol válido" }),
  // Código de invitación (opcional, solo para el garante).
  invitationCode: z.string().trim().max(64).optional(),
});

/** Datos universitarios del estudiante (student_profiles). */
export const universidadSchema = z.object({
  universityName: z.string().trim().min(2, "La universidad es obligatoria").max(160),
  career: z.string().trim().min(2, "La carrera es obligatoria").max(120),
  studentCode: z.string().trim().max(40).optional(),
  semester: z.coerce
    .number({ error: "El semestre es obligatorio" })
    .int()
    .min(1, "Semestre inválido")
    .max(14, "Semestre inválido"),
});

/** Campos SEP-12 que acompañan los documentos del KYC. */
export const kycSchema = z.object({
  firstName: z.string().trim().min(2, "El nombre es obligatorio").max(80),
  lastName: z.string().trim().min(2, "El apellido es obligatorio").max(80),
  idNumber: z.string().trim().min(4, "El carnet es obligatorio").max(30),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});

export const invitacionSchema = z.object({
  guarantorEmail: email,
});

/** Solicitud de préstamo del estudiante. */
export const solicitudSchema = z.object({
  amountUsd: z.coerce.number({ error: "Monto inválido" }).positive("Monto inválido"),
  installments: z.coerce.number().int().min(1, "Mínimo 1 cuota"),
  purpose: z.enum(["tuition", "laptop", "course", "materials", "other"]),
  purposeDetail: z.string().trim().max(300).optional(),
});

/** Decisión del operador sobre una solicitud o un KYC. */
export const revisionSchema = z.object({
  id: z.string().uuid("Identificador inválido"),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(300).optional(),
});

/** Paso del flujo on-chain de un préstamo. */
export const pasoPrestamoSchema = z.object({
  applicationId: z.string().uuid("Identificador inválido"),
  step: z.enum(["deposit", "open"]),
  signedXdr: z.string().optional(),
});

/** Pago de una cuota. Sin montos: paga la próxima cuota completa. */
export const pagoSchema = z.object({
  loanId: z.coerce.number().int().positive(),
  principalUsd: z.coerce.number().min(0).optional(),
  interestUsd: z.coerce.number().min(0).optional(),
  signedXdr: z.string().optional(),
});

/** Parámetros globales que edita el admin (porcentajes en bps). */
export const parametrosSchema = z.object({
  max_ltv_bps: z.coerce.number().int().min(1).max(10_000),
  rate_bps: z.coerce.number().int().min(0).max(10_000),
  origination_fee_bps: z.coerce.number().int().min(0).max(9_999),
  late_fee_bps: z.coerce.number().int().min(0).max(10_000),
  yield_share_platform_bps: z.coerce.number().int().min(0).max(10_000),
  grace_seconds: z.coerce.number().int().min(0),
  min_amount_usd: z.coerce.number().positive(),
  max_amount_usd: z.coerce.number().positive(),
  max_installments: z.coerce.number().int().min(1).max(60),
});
