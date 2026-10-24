// Genera lib/database.types.ts desde la base real: npm run db:types
// Usa DATABASE_URL de .env.local (no necesita `supabase login` ni Docker).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL en .env.local");

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const opciones = { encoding: "utf8", shell: process.platform === "win32", stdio: ["ignore", "pipe", "inherit"] };
const tipos = execFileSync(npx, ["-y", "supabase@2.122.0", "gen", "types", "typescript", "--db-url", url, "--schema", "public"], opciones);
writeFileSync("lib/database.types.ts", tipos);
execFileSync(npx, ["-y", "oxfmt@0.74.0", "lib/database.types.ts"], { ...opciones, stdio: "inherit" });
console.log("lib/database.types.ts actualizado");
