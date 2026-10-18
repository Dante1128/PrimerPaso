import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import ComoFunciona from "@/components/landing/ComoFunciona";
import Beneficios from "@/components/landing/Beneficios";
import Simulador from "@/components/landing/Simulador";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <ComoFunciona />
        <Beneficios />
        <Simulador />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
