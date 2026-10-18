import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser, pasoPendiente } from "@/lib/auth";
import TopBar from "@/components/panel/TopBar";
import PanelEstudiante from "@/components/panel/PanelEstudiante";
import PanelGarante from "@/components/panel/PanelGarante";
import PanelOperador from "@/components/panel/PanelOperador";
import PanelAdmin from "@/components/panel/PanelAdmin";

export const metadata = { title: "Mi panel · PrimerPaso" };

// Lee la sesión (cookies) en cada petición: ruta dinámica, no prerenderizable.
export const instant = false;

export default async function PanelPage() {
  await connection();
  const user = await getSessionUser();
  if (!user) redirect("/ingresar");
  // Onboarding incompleto: lo retoma el flujo de registro.
  if (pasoPendiente(user)) redirect("/registro");
  const nombre = user.fullName ?? user.email;

  return (
    <main className="min-h-screen bg-cream">
      <TopBar nombre={nombre} rol={user.role} wallet={user.wallet} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {user.role === "student" && <PanelEstudiante user={user} />}
        {user.role === "guarantor" && <PanelGarante user={user} />}
        {user.role === "operator" && <PanelOperador nombre={nombre} />}
        {user.role === "admin" && <PanelAdmin nombre={nombre} />}
      </div>
    </main>
  );
}
