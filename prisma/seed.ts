// Datos de prueba (seed) de PrimerPaso.
// Crea 2 estudiantes, 1 garante y 1 admin, ya con email verificado, KYC
// aprobado y wallet vinculada a las cuentas de Testnet fondeadas.
//
// Contraseña de todas las cuentas de prueba: "Password123"
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Direcciones de las cuentas de prueba desplegadas en Testnet.
const WALLETS = {
  admin: "GC42PHGGXJCKV2ZRCHXYRI44QPPG4G5SFYHYNUM2CANGMFCHBO2OAEOK",
  estudiante1: "GBWCSVDN7HAVJN2DDXDWMUKPYUZAXN2WSRZ6Y4SJY3D4OFVSEGPTJHLS",
  estudiante2: "GBHB3ISZVVPC4W2DXRMFO5V45CYCNYVYQZAVC652HWXL2KVAF3ZOMTHG",
  garante: "GAS6JEQPY225KG4U2FJVP3D6BNLPAU6E2DFP226PEMZ37ZKSB3BYQ6Q6",
};

async function crearUsuario(datos: {
  fullName: string;
  email: string;
  idCard: string;
  university: string;
  career: string;
  studyYear: number;
  role: string;
  walletAddress: string;
}) {
  const passwordHash = await bcrypt.hash("Password123", 10);
  return prisma.user.upsert({
    where: { email: datos.email },
    update: { ...datos, passwordHash, emailVerified: true },
    create: {
      ...datos,
      passwordHash,
      emailVerified: true,
      kyc: {
        create: { status: "ACCEPTED", type: "individual", provider: "mock" },
      },
    },
  });
}

async function main() {
  const admin = await crearUsuario({
    fullName: "Admin PrimerPaso",
    email: "admin@primerpaso.bo",
    idCard: "0000000",
    university: "PrimerPaso",
    career: "Administración",
    studyYear: 1,
    role: "ADMIN",
    walletAddress: WALLETS.admin,
  });

  const est1 = await crearUsuario({
    fullName: "María Condori",
    email: "maria@est.umsa.bo",
    idCard: "8123456",
    university: "UMSA",
    career: "Ingeniería de Sistemas",
    studyYear: 3,
    role: "ESTUDIANTE",
    walletAddress: WALLETS.estudiante1,
  });

  const est2 = await crearUsuario({
    fullName: "Carlos Mamani",
    email: "carlos@est.upb.bo",
    idCard: "9234567",
    university: "UPB",
    career: "Economía",
    studyYear: 2,
    role: "ESTUDIANTE",
    walletAddress: WALLETS.estudiante2,
  });

  const garante = await crearUsuario({
    fullName: "Rosa Quispe",
    email: "rosa@familia.bo",
    idCard: "5111222",
    university: "N/A",
    career: "N/A",
    studyYear: 1,
    role: "GARANTE",
    walletAddress: WALLETS.garante,
  });

  // El garante (Rosa) respalda a la estudiante 1 (María) vía invitación.
  await prisma.invitation.upsert({
    where: { code: "PP-DEMO01" },
    update: { guarantorId: garante.id, usedAt: new Date() },
    create: {
      code: "PP-DEMO01",
      studentId: est1.id,
      guarantorId: garante.id,
      usedAt: new Date(),
    },
  });

  // Rosa también respalda al estudiante 2 (Carlos).
  await prisma.invitation.upsert({
    where: { code: "PP-DEMO02" },
    update: { guarantorId: garante.id, usedAt: new Date() },
    create: {
      code: "PP-DEMO02",
      studentId: est2.id,
      guarantorId: garante.id,
      usedAt: new Date(),
    },
  });

  console.log("Seed completado:");
  console.log(`  admin:       ${admin.email}`);
  console.log(`  estudiante1: ${est1.email}  (garante: ${garante.email})`);
  console.log(`  estudiante2: ${est2.email}`);
  console.log(`  garante:     ${garante.email}`);
  console.log("  contraseña de todas: Password123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
