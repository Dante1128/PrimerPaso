import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { verifyChallenge } from "@/lib/sep10";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const signedXdr: string | undefined = body?.signedXdr;
  if (!signedXdr) {
    return NextResponse.json(
      { error: "Falta la transacción firmada" },
      { status: 400 },
    );
  }

  let address: string;
  try {
    address = verifyChallenge(signedXdr);
  } catch {
    return NextResponse.json(
      { error: "La firma del challenge no es válida" },
      { status: 400 },
    );
  }

  // La wallet no puede estar vinculada a otra cuenta.
  const otro = await prisma.user.findUnique({ where: { walletAddress: address } });
  if (otro && otro.id !== user.id) {
    return NextResponse.json(
      { error: "Esa wallet ya está vinculada a otra cuenta" },
      { status: 409 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { walletAddress: address },
  });

  return NextResponse.json({ ok: true, address });
}
