import Link from "next/link";
import Logo from "@/components/Logo";

export default function RegistroPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-teal-50/70 to-white px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Link href="/" className="inline-block">
          <Logo />
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">
          Crear cuenta
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          El registro de usuarios (datos, verificación de email, KYC y conexión
          de wallet) llega en la siguiente etapa.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-700"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
