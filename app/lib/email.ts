// Verificación de email por código.
//
// En el MVP el "envío" se registra en la consola del servidor y el código se
// devuelve para mostrarlo en pantalla (modo demo). La función
// `enviarEmail` está aislada para que, en producción, se conecte un proveedor
// real (Resend, SES, SMTP...) sin tocar el resto del flujo.
import { prisma } from "@/lib/db";

const EXPIRA_MINUTOS = 15;

/** Genera un código de 6 dígitos, lo guarda y lo "envía". */
export async function crearYEnviarCodigo(
  userId: string,
  email: string,
): Promise<{ code: string }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + EXPIRA_MINUTOS * 60 * 1000);

  await prisma.emailVerification.create({
    data: { userId, code, expiresAt },
  });

  await enviarEmail(
    email,
    "Tu código de verificación de PrimerPaso",
    `Tu código es: ${code} (válido por ${EXPIRA_MINUTOS} minutos).`,
  );

  return { code };
}

/** Valida un código vigente y no consumido para el usuario. */
export async function validarCodigo(
  userId: string,
  code: string,
): Promise<boolean> {
  const registro = await prisma.emailVerification.findFirst({
    where: { userId, code, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!registro) return false;

  await prisma.emailVerification.update({
    where: { id: registro.id },
    data: { consumed: true },
  });
  return true;
}

/** Punto de integración del proveedor de email. En el MVP solo registra. */
async function enviarEmail(para: string, asunto: string, cuerpo: string) {
  // TODO(producción): reemplazar por un proveedor real (SMTP/Resend/SES).
  console.log(`\n[EMAIL -> ${para}] ${asunto}\n${cuerpo}\n`);
}

/** ¿Estamos en modo demo? Entonces mostramos el código en la UI. */
export const MOSTRAR_CODIGO_EN_UI = process.env.NODE_ENV !== "production";
