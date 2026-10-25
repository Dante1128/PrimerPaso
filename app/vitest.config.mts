import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const raiz = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": raiz("."),
      // En los tests los módulos del servidor se importan directo.
      "server-only": raiz("node_modules/server-only/empty.js"),
    },
  },
  test: { include: ["**/*.test.ts"], exclude: ["node_modules", ".next"] },
});
