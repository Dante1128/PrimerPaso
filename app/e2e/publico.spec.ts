import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/settings", (route) => route.fulfill({ json: { settings: {
    max_ltv_bps: 8000, rate_bps: 800, origination_fee_bps: 100, late_fee_bps: 200,
    min_amount_usd: 100, max_amount_usd: 3000, max_installments: 12,
  } } }));
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: null } }));
});

test("landing y simulador sin desbordamiento horizontal", async ({ page }, info) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("primer crédito");
  await page.getByRole("link", { name: "Probar el simulador" }).click();
  await expect(page.locator("#simulador")).toBeInViewport();
  await expect(page.locator("#sim-monto")).toHaveValue("1000");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(errores).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("landing.png"), fullPage: true });
});

test("ingreso muestra un error comprensible y permite volver a intentar", async ({ page }, info) => {
  await page.route("**/api/auth/login", (route) => route.fulfill({ status: 503, json: { error: "No se pudo conectar. Intenta de nuevo." } }));
  await page.goto("/ingresar");
  // Esperar una interacción de React evita escribir antes de la hidratación.
  await page.getByRole("button", { name: "Con código", exact: true }).click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Con contraseña", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("prueba@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("SoloPrueba2026!");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByText("No se pudo conectar. Intenta de nuevo.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingresar", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: info.outputPath("ingreso.png"), fullPage: true });
});

test("registro inicial y protección de rutas privadas", async ({ page, request }, info) => {
  await page.goto("/registro");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: info.outputPath("registro.png"), fullPage: true });
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/ingresar/);
  for (const path of ["/api/loans/prepare", "/api/loans/submit", "/api/payments/prepare", "/api/payments/submit", "/api/applications/review", "/api/kyc/review"]) {
    expect((await request.post(path, { data: {} })).status(), path).toBe(401);
  }
  expect((await request.get("/api/cron/indexer")).status()).toBe(401);
});
