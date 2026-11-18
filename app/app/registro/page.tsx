import RegistroWizard from "@/components/registro/RegistroWizard";

export const metadata = { title: "Crear cuenta · PrimerPaso" };
// El login de Pollar lee la hora al montarse: no se puede prerenderizar.
export const instant = false;

export default function RegistroPage() {
  return <RegistroWizard />;
}
