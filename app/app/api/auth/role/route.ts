import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { rolSchema } from "@/lib/validation";

/** Genera un código de invitación legible, p. ej. "PP-7K3QX9". */
function nuevoCodigo(): string {
  const alf = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let s = "";
  for (const b of bytes) s += alf[b % alf.length];
  return `PP-${s}`;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const parsed = rolSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }
  const { role, invitationCode } = parsed.data;

  // Garante: puede vincularse a un estudiante mediante un código de invitación.
  if (role === "GARANTE" && invitationCode) {
    const inv = await prisma.invitation.findUnique({
      where: { code: invitationCode.trim() },
      include: { student: true },
    });
    if (!inv || inv.guarantorId) {
      return NextResponse.json(
        { error: "Código de invitación inválido o ya usado" },
        { status: 400 },
      );
    }
    if (inv.studentId === user.id) {
      return NextResponse.json(
        { error: "No puedes vincularte a ti mismo" },
        { status: 400 },
      );
    }
    await prisma.invitation.update({
      where: { id: inv.id },
      data: { guarantorId: user.id, usedAt: new Date() },
    });
  }

  await prisma.user.update({ where: { id: user.id }, data: { role } });

  // Estudiante: generamos un código para que invite a un garante.
  let codigoGenerado: string | undefined;
  if (role === "ESTUDIANTE") {
    const existente = await prisma.invitation.findFirst({
      where: { studentId: user.id, guarantorId: null },
    });
    if (existente) {
      codigoGenerado = existente.code;
    } else {
      const inv = await prisma.invitation.create({
        data: { code: nuevoCodigo(), studentId: user.id },
      });
      codigoGenerado = inv.code;
    }
  }

  return NextResponse.json({ ok: true, role, invitationCode: codigoGenerado });
}
