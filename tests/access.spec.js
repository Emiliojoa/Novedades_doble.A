import { test, expect } from "./fixtures.js";
import { randomBytes } from "node:crypto";

test("El contexto ignora roles de localStorage y bloquea rutas y APIs administrativas para CLIENT", async ({
  page,
}) => {
  const response = await page.request.post("/api/auth/register", {
    data: {
      first_name: "Cliente",
      last_name: "Permisos",
      email: `access-${randomBytes(6).toString("hex")}@example.test`,
      password: randomBytes(24).toString("hex"),
    },
  });
  expect(response.status()).toBe(201);
  await page.goto("/perfil");
  await page.evaluate(() => {
    localStorage.setItem("role", "ADMIN");
    localStorage.setItem("user", JSON.stringify({ id: 1, role: "ADMIN" }));
  });
  const adminCalls = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/admin/"))
      adminCalls.push(request.url());
  });
  for (const path of [
    "/admin",
    "/admin/pagos",
    "/admin/pedidos",
    "/admin/usuarios",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/perfil$/);
    await expect(
      page.getByRole("heading", { name: "Configuración de pagos" }),
    ).toHaveCount(0);
  }
  expect(adminCalls).toEqual([]);
  expect(
    (
      await page.request.get("/api/admin/payment-settings", {
        headers: { "x-role": "ADMIN" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.put("/api/admin/payment-settings", {
        data: { bank_alias: "otro.alias.mp", cash_discount_percentage: 99 },
      })
    ).status(),
  ).toBe(403);
  expect((await page.request.get("/api/admin/unknown")).status()).toBe(403);
});

test("ADMIN entra al panel y revalida la sesión antes de abrir pagos, conservando el diseño", async ({
  page,
  playwright,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3011/admin");
  await page
    .getByRole("link", { name: "Configuración de pagos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Configuración de pagos" }),
  ).toBeVisible();
  await expect(page.getByLabel("Alias bancario")).toBeVisible();
  await expect(page.getByLabel("Porcentaje de descuento")).toBeVisible();
  const style = await page
    .getByRole("heading", { name: "Configuración de pagos" })
    .evaluate((el) => ({
      font: getComputedStyle(el).fontFamily,
      color: getComputedStyle(el).color,
    }));
  expect(style.font.toLowerCase()).toContain("poppins");
  // End the session on the server without deleting the browser cookie or context.
  const token = (await page.context().cookies()).find(
    (cookie) => cookie.name === "session",
  );
  const external = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3011",
  });
  await external.post("/api/auth/logout", {
    headers: { cookie: `session=${token.value}` },
  });
  await external.dispose();
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(
    page.getByRole("heading", { name: "Configuración de pagos" }),
  ).toHaveCount(0);
  expect((await page.request.get("/api/admin/payments")).status()).toBe(401);
});

test("La configuración de pago mantiene su estilo y el logout administrativo cierra sesión", async ({
  page,
}) => {
  await page.request.post("/api/auth/login", {
    data: {
      email: "admin@example.test",
      password: process.env.E2E_ADMIN_PASSWORD,
    },
  });
  await page.goto("/admin/pagos");
  await expect(page.getByLabel("Alias bancario")).toBeVisible();
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Guardar configuración" }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL("http://127.0.0.1:3011/login");
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await page.goto("/admin/pagos");
  await expect(page).toHaveURL(/\/login\?next=/);
});
