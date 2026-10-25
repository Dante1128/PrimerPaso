import { connection } from "next/server";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Ingresar · PrimerPaso" };

// Lee ?error= de la vuelta de /auth/callback.
export const instant = false;

const ERRORES: Record<string, string> = {
  enlace: "El enlace no es válido o ya venció. Vuelve a intentarlo.",
  staff_google: "Las cuentas del equipo de PrimerPaso no ingresan con Google. Usa tu contraseña o un código.",
  sesion_vencida: "Tu sesión de equipo venció (máximo 12 horas). Vuelve a ingresar.",
};

export default async function IngresarPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const { error } = await searchParams;
  return <LoginForm errorInicial={error ? ERRORES[error] : undefined} />;
}
