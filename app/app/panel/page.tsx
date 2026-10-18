import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import TopBar from "@/components/panel/TopBar";
import PanelEstudiante from "@/components/panel/PanelEstudiante";
import PanelGarante from "@/components/panel/PanelGarante";
import PanelAdmin from "@/components/panel/PanelAdmin";

export const metadata = { title: "Mi panel · PrimerPaso" };

// Lee la sesión (cookies) en cada petición: ruta dinámica, no prerenderizable.
export const instant = false;

export default async function PanelPage() {
  const user = await getSessionUser();
  if (!user) redirect("/ingresar");
  // Onboarding incompleto: lo retoma el flujo de registro.
  if (!user.emailVerified || !user.role || !user.walletAddress) {
    redirect("/registro");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <TopBar nombre={user.fullName} rol={user.role} wallet={user.walletAddress} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {user.role === "ESTUDIANTE" && <PanelEstudiante />}
        {user.role === "GARANTE" && <PanelGarante />}
        {user.role === "ADMIN" && <PanelAdmin />}
      </div>
    </main>
  );
}
