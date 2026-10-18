import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { crearYEnviarCodigo, MOSTRAR_CODIGO_EN_UI } from "@/lib/email";
import { registroSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  // Normalizamos el año de estudio a número antes de validar.
  const parsed = registroSchema.safeParse({
    ...body,
    studyYear: Number(body.studyYear),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detalles: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const existe = await prisma.user.findUnique({ where: { email: data.email } });
  if (existe) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese email" },
      { status: 409 },
    );
  }

  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      idCard: data.idCard,
      university: data.university,
      career: data.career,
      studyYear: data.studyYear,
    },
  });

  // Inicia sesión y envía el código de verificación.
  await createSession(user.id);
  const { code } = await crearYEnviarCodigo(user.id, user.email);

  return NextResponse.json({
    ok: true,
    userId: user.id,
    // En modo demo devolvemos el código para mostrarlo en pantalla.
    devCode: MOSTRAR_CODIGO_EN_UI ? code : undefined,
  });
}
