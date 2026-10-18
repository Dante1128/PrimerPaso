import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { leerPrestamo, estaEnMora } from "@/lib/soroban";

/** Préstamos que respalda el garante logueado (vía invitaciones usadas). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const invitaciones = await prisma.invitation.findMany({
    where: { guarantorId: user.id },
    include: {
      student: {
        select: {
          fullName: true,
          university: true,
          career: true,
          walletAddress: true,
        },
      },
    },
  });

  const respaldos = await Promise.all(
    invitaciones.map(async (inv) => {
      const wallet = inv.student.walletAddress;
      const prestamo = wallet ? await leerPrestamo(wallet) : null;
      return {
        estudiante: {
          nombre: inv.student.fullName,
          universidad: inv.student.university,
          carrera: inv.student.career,
          wallet,
        },
        prestamo,
        enMora: prestamo ? estaEnMora(prestamo) : false,
      };
    }),
  );

  return NextResponse.json({ respaldos });
}
