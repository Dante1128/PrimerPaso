import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { leerPrestamo, leerPuntaje, estaEnMora } from "@/lib/soroban";

/** Todos los préstamos de estudiantes, para el panel de administrador. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const estudiantes = await prisma.user.findMany({
    where: { role: "ESTUDIANTE", walletAddress: { not: null } },
    select: { fullName: true, university: true, walletAddress: true },
  });

  const prestamos = await Promise.all(
    estudiantes.map(async (e) => {
      const wallet = e.walletAddress!;
      const [prestamo, puntaje] = await Promise.all([
        leerPrestamo(wallet),
        leerPuntaje(wallet),
      ]);
      return {
        estudiante: { nombre: e.fullName, universidad: e.university, wallet },
        prestamo,
        puntaje,
        enMora: prestamo ? estaEnMora(prestamo) : false,
      };
    }),
  );

  // Primero los que tienen préstamo activo.
  prestamos.sort((a, b) => {
    const pa = a.prestamo?.status === "Active" ? 0 : 1;
    const pb = b.prestamo?.status === "Active" ? 0 : 1;
    return pa - pb;
  });

  return NextResponse.json({ prestamos });
}
