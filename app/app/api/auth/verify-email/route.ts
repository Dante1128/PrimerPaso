import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  crearYEnviarCodigo,
  validarCodigo,
  MOSTRAR_CODIGO_EN_UI,
} from "@/lib/email";
import { verificarEmailSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  // Reenviar código.
  if (body?.resend) {
    const { code } = await crearYEnviarCodigo(user.id, user.email);
    return NextResponse.json({
      ok: true,
      devCode: MOSTRAR_CODIGO_EN_UI ? code : undefined,
    });
  }

  const parsed = verificarEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "El código debe tener 6 dígitos" },
      { status: 400 },
    );
  }

  const valido = await validarCodigo(user.id, parsed.data.code);
  if (!valido) {
    return NextResponse.json(
      { error: "Código inválido o expirado" },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true },
  });

  return NextResponse.json({ ok: true });
}
