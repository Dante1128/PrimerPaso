import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [
    { name: "movil-pequeno", use: { viewport: { width: 320, height: 740 }, isMobile: true } },
    { name: "movil", use: { viewport: { width: 390, height: 844 }, isMobile: true } },
    { name: "escritorio", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    // Valores ficticios solo para pruebas locales sin cookies ni conexión a Supabase.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "clave-publica-de-pruebas",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
    },
  },
});
