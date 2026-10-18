// KYC con estructura SEP-12: campos + documentos (carnet y selfie).
// Los archivos van al bucket PRIVADO "kyc-docs" y la solicitud queda
// "pending" hasta que un operator la revise.
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, errorJson } from "@/lib/auth";
import { kycSchema } from "@/lib/validation";

const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return errorJson("No autenticado", 401);

  const form = await req.formData().catch(() => null);
  if (!form) return errorJson("Formulario inválido", 400);

  const parsed = kycSchema.safeParse({
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    idNumber: form.get("idNumber"),
    birthDate: form.get("birthDate"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Datos inválidos", detalles: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const archivos = { carnet: form.get("carnet"), selfie: form.get("selfie") };
  for (const [nombre, f] of Object.entries(archivos)) {
    if (!(f instanceof File) || f.size === 0) return errorJson(`Falta el archivo: ${nombre}`, 400);
    if (f.size > MAX_BYTES) return errorJson(`${nombre}: máximo 5 MB`, 400);
    if (!TIPOS.has(f.type)) return errorJson(`${nombre}: usa JPG, PNG, WEBP o PDF`, 400);
  }

  const db = supabaseAdmin();
  const paths: string[] = [];
  for (const [nombre, f] of Object.entries(archivos) as [string, File][]) {
    const ext = f.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${user.id}/${nombre}-${Date.now()}.${ext}`;
    const { error } = await db.storage
      .from("kyc-docs")
      .upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: false });
    if (error) return errorJson(`No se pudo subir ${nombre}: ${error.message}`, 500);
    paths.push(path);
  }

  const d = parsed.data;
  const { error } = await db.from("kyc_submissions").insert({
    profile_id: user.id,
    status: "pending",
    sep12_fields: {
      type: "individual",
      first_name: d.firstName,
      last_name: d.lastName,
      id_type: "national_id",
      id_number: d.idNumber,
      id_country_code: "BOL",
      birth_date: d.birthDate,
      email_address: user.email,
    },
    document_paths: paths,
  });
  if (error) return errorJson(error.message, 500);

  // Huella del documento para detectar duplicados sin exponer el número.
  const hash = createHash("sha256").update(`BOL:${d.idNumber.toUpperCase()}`).digest("hex");
  await db.from("profiles").update({ document_hash: hash }).eq("id", user.id);

  return Response.json({ ok: true, status: "pending" });
}
