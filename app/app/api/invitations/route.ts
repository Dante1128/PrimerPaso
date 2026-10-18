import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function nuevoCodigo(): string {
  const alf = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (const b of randomBytes(6)) s += alf[b % alf.length];
  return `PP-${s}`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const invitaciones = await prisma.invitation.findMany({
    where: { studentId: user.id },
    include: { guarantor: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    invitaciones: invitaciones.map((i) => ({
      code: i.code,
      usada: !!i.guarantorId,
      garante: i.guarantor,
      createdAt: i.createdAt,
    })),
  });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (user.role !== "ESTUDIANTE") {
    return NextResponse.json(
      { error: "Solo los estudiantes generan invitaciones" },
      { status: 403 },
    );
  }
  const inv = await prisma.invitation.create({
    data: { code: nuevoCodigo(), studentId: user.id },
  });
  return NextResponse.json({ ok: true, code: inv.code });
}
