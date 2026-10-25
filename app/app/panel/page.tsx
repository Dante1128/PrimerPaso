import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser, pasoPendiente, revisarSesionStaff } from "@/lib/auth";
import { supabaseServidor } from "@/lib/supabase/server";
import { exigeMfaStaff } from "@/lib/politica-staff";
import { AvisoMfaTestnet, VerificacionMfa } from "@/components/panel/MfaStaff";
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

  // Reglas del staff: sesión de 12 h, sin Google y MFA si es obligatorio.
  const exigirMfa = exigeMfaStaff();
  const staff = revisarSesionStaff(user);
  if (!staff.ok && staff.codigo !== "MFA_REQUERIDO") {
    await (await supabaseServidor()).auth.signOut({ scope: "local" });
    redirect(staff.codigo === "SESION_VENCIDA" ? "/ingresar?error=sesion_vencida" : "/ingresar?error=staff_google");
  }
  const mfaPendiente = !staff.ok;

  return (
    <main className="min-h-screen bg-cream">
      <TopBar nombre={nombre} rol={user.role} wallet={user.wallet} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {mfaPendiente && (
          <div className="mx-auto max-w-md">
            <VerificacionMfa obligatoria />
          </div>
        )}
        {user.esStaff && !exigirMfa && (
          <AvisoMfaTestnet configurado={user.mfaConfigurado} verificadoAhora={user.sesion.aal === "aal2"} />
        )}
        {user.role === "student" && <PanelEstudiante user={user} />}
        {user.role === "guarantor" && <PanelGarante user={user} />}
        {user.role === "operator" && !mfaPendiente && <PanelOperador nombre={nombre} />}
        {user.role === "admin" && !mfaPendiente && <PanelAdmin nombre={nombre} adminId={user.id} />}
      </div>
    </main>
  );
}
