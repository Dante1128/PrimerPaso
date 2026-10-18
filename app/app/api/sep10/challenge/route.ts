import { NextResponse } from "next/server";
import { buildChallenge } from "@/lib/sep10";
import { NETWORK_PASSPHRASE } from "@/lib/stellar";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const account = searchParams.get("account");

  if (!account || !/^G[A-Z2-7]{55}$/.test(account)) {
    return NextResponse.json(
      { error: "Parámetro 'account' inválido" },
      { status: 400 },
    );
  }

  try {
    const challenge = buildChallenge(account);
    return NextResponse.json({
      challenge,
      network_passphrase: NETWORK_PASSPHRASE,
    });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: err.message ?? "No se pudo crear el challenge" },
      { status: 500 },
    );
  }
}
