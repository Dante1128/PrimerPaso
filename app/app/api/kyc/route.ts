import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { kycSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const parsed = kycSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Faltan la foto del carnet y/o la selfie" },
      { status: 400 },
    );
  }

  // MVP: se aprueba automáticamente. La estructura (status/type/provider)
  // sigue SEP-12 para conectar un proveedor real sin cambiar el flujo.
  const kyc = await prisma.kycSubmission.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      status: "ACCEPTED",
      type: "individual",
      provider: "mock",
      idDocPath: parsed.data.idDoc.slice(0, 200000),
      selfiePath: parsed.data.selfie.slice(0, 200000),
    },
    update: {
      status: "ACCEPTED",
      idDocPath: parsed.data.idDoc.slice(0, 200000),
      selfiePath: parsed.data.selfie.slice(0, 200000),
    },
  });

  return NextResponse.json({ ok: true, status: kyc.status });
}
