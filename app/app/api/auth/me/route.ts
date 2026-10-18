import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }

  // Devolvemos solo campos seguros (nunca el hash de la contraseña).
  return NextResponse.json({
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      idCard: user.idCard,
      university: user.university,
      career: user.career,
      studyYear: user.studyYear,
      role: user.role,
      emailVerified: user.emailVerified,
      walletAddress: user.walletAddress,
      kycStatus: user.kyc?.status ?? null,
    },
  });
}
