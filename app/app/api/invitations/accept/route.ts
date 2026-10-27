// El garante (ya registrado) se vincula a un estudiante con su código.
import { z } from "zod";
import { exigirUsuario, manejar, ErrorApi, auditar } from "@/lib/api";
import { aceptarInvitacion } from "@/lib/invitaciones";

export const POST = manejar(async (req: Request) => {
  const user = await exigirUsuario(["guarantor"]);
  const parsed = z.object({ code: z.string().trim().min(4).max(64) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ErrorApi("Escribe el código que te compartió el estudiante");

  const error = await aceptarInvitacion(user.id, parsed.data.code);
  if (error) throw new ErrorApi(error);
  await auditar(user.id, "invitation_accepted", "guarantor_invitation", parsed.data.code.toLowerCase());
  return Response.json({ ok: true });
});
