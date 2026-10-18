// Esquemas de validación (zod) para el registro y la autenticación.
import { z } from "zod";

/** Datos de creación de cuenta. Valida todos los campos del pedido. */
export const registroSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "El nombre completo es obligatorio")
    .max(120, "Nombre demasiado largo"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(100, "Contraseña demasiado larga"),
  idCard: z
    .string()
    .trim()
    .min(4, "El carnet de identidad es obligatorio")
    .max(30, "Carnet inválido"),
  university: z.string().trim().min(2, "La universidad es obligatoria"),
  career: z.string().trim().min(2, "La carrera es obligatoria"),
  studyYear: z
    .number({ error: "El año de estudio es obligatorio" })
    .int()
    .min(1, "Año de estudio inválido")
    .max(10, "Año de estudio inválido"),
});
export type RegistroInput = z.infer<typeof registroSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export const verificarEmailSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
});

export const rolSchema = z.object({
  role: z.enum(["ESTUDIANTE", "GARANTE"], {
    error: "Elige un rol válido",
  }),
  // Código de invitación (obligatorio solo para el garante).
  invitationCode: z.string().trim().optional(),
});

export const kycSchema = z.object({
  // En el MVP guardamos las imágenes como data URL o nombre de archivo.
  idDoc: z.string().min(1, "Sube una foto de tu carnet"),
  selfie: z.string().min(1, "Sube una selfie"),
});
