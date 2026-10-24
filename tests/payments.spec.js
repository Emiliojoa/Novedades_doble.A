import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

test("Confirmación recuperable: respuesta perdida y recarga no duplican pedido ni stock", async ({
  page,
  playwright,
}) => {
  const baseURL = "http://127.0.0.1:3011",
    suffix = randomBytes(4).toString("hex");
  const admin = await playwright.request.newContext({ baseURL });
  await admin.post("/api/auth/login", {
    data: {
      email: "admin@example.test",
      password: process.env.E2E_ADMIN_PASSWORD,
    },
  });
  const category = await (
    await admin.post("/api/categories", {
      data: { name: `Recuperación ${suffix}` },
    })
  ).json();
  const product = await (
    await admin.post("/api/products", {
      data: {
        name: `Recuperable ${suffix}`,
        price: 5000000,
        stock: 5,
        min_stock: 1,
        image: "",
        category_id: category.id,
        type: "PRODUCTO",
        active: true,
      },
    })
  ).json();
  await page.request.post("/api/auth/register", {
    data: {
      first_name: "Retry",
      last_name: "Cliente",
      email: `retry-${suffix}@example.test`,
      password: randomBytes(20).toString("hex"),
    },
  });
  await page.request.post("/api/cart/items", {
    data: { product_id: product.id, quantity: 1 },
  });
  await page.goto("/carrito");
  await page.getByRole("radio", { name: /Pago en efectivo/ }).check();
  await page.route(
    "**/api/orders",
    async (route) => {
      await route.fetch();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Confirmar pedido", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Recuperar confirmación del pedido" }),
  ).toBeEnabled();
  await page.reload();
  await page
    .getByRole("button", { name: "Recuperar confirmación del pedido" })
    .click();
  await expect(page).toHaveURL(/pedidos\/\d+/);
  const orders = await (await page.request.get("/api/orders")).json();
  expect(orders).toHaveLength(1);
  expect(
    (await (await admin.get(`/api/products/${product.id}`)).json()).stock,
  ).toBe(4);
  await admin.dispose();
});

test("Pagos: efectivo, transferencia, rechazo, reenvío y aprobación con UI responsive", async ({
  page,
  playwright,
  browser,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const baseURL = "http://127.0.0.1:3011";
  const adminApi = await playwright.request.newContext({ baseURL });
  expect(
    (
      await adminApi.post("/api/auth/login", {
        data: {
          email: "admin@example.test",
          password: process.env.E2E_ADMIN_PASSWORD,
        },
      })
    ).ok(),
  ).toBeTruthy();
  const suffix = randomBytes(4).toString("hex");
  const category = await (
    await adminApi.post("/api/categories", {
      data: { name: `Pagos ${suffix}` },
    })
  ).json();
  const product = await (
    await adminApi.post("/api/products", {
      data: {
        name: `Producto pagos ${suffix}`,
        description: "Prueba completa de compra",
        price: 5000000,
        stock: 10,
        min_stock: 1,
        image: "",
        category_id: category.id,
        subcategory_id: null,
        type: "PRODUCTO",
        active: true,
        featured: false,
      },
    })
  ).json();
  expect(product.id).toBeTruthy();
  expect(
    (
      await page.request.post("/api/auth/register", {
        data: {
          first_name: "Cliente",
          last_name: "Pagos",
          email: `pagos-${suffix}@example.test`,
          password: randomBytes(20).toString("hex"),
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.request.post("/api/cart/items", {
    data: { product_id: product.id, quantity: 1 },
  });
  await page.goto("/carrito");
  const confirm = page.getByRole("button", {
    name: "Confirmar pedido",
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  await page.getByRole("radio", { name: /Pago en efectivo/ }).check();
  await expect(page.locator(".payment-totals")).toContainText("48.500");
  await expect(page.locator(".payment-totals")).toContainText("1.500");
  await page.getByRole("radio", { name: /Transferencia bancaria/ }).check();
  await expect(confirm).toBeDisabled();
  await expect(page.locator(".payment-totals")).toContainText("50.000");
  await expect(page.locator(".bank-alias")).toContainText("emilio.joa.mp");
  await page.getByRole("radio", { name: /Pago en efectivo/ }).check();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/payments-cash-mobile.png",
    fullPage: true,
  });
  await confirm.click();
  await expect(page).toHaveURL(/pedidos\/\d+/);
  const cashId = page.url().match(/pedidos\/(\d+)/)[1];
  await expect(
    page.getByText("El pago se encuentra pendiente de confirmación.", {
      exact: true,
    }),
  ).toBeVisible();
  const adminContext = await browser.newContext({
    storageState: await adminApi.storageState(),
    baseURL,
  });
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`/admin/pedidos/${cashId}`);
  await adminPage
    .getByRole("button", { name: "Confirmar pago recibido", exact: true })
    .click();
  await expect(adminPage.getByRole("dialog")).toBeVisible();
  await adminPage
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(
    adminPage.locator(".payment-section > .payment-badge"),
  ).toHaveText("Pago aprobado");
  await page.reload();
  await expect(page.locator(".payment-section > .payment-badge")).toHaveText(
    "Pago aprobado",
  );
  await page.request.post("/api/cart/items", {
    data: { product_id: product.id, quantity: 1 },
  });
  await page.goto("/carrito");
  await page.getByRole("radio", { name: /Transferencia bancaria/ }).check();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGJ8AAAAASUVORK5CYII=",
    "base64",
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "comprobante.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    page.getByText("comprobante.png", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByAltText("Vista previa del comprobante seleccionado"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/payments-transfer-mobile.png",
    fullPage: true,
  });
  await confirm.click();
  await expect(page).toHaveURL(/pedidos\/\d+/);
  const transferId = page.url().match(/pedidos\/(\d+)/)[1];
  await expect(
    page.getByText("Estamos verificando tu transferencia."),
  ).toBeVisible();
  await adminPage.goto(`/admin/pedidos/${transferId}`);
  await adminPage
    .getByRole("button", { name: "Ver y ampliar comprobante" })
    .click();
  await expect(
    adminPage.getByAltText("Comprobante de transferencia ampliado"),
  ).toBeVisible();
  const download = adminPage.waitForEvent("download");
  await adminPage
    .getByRole("button", { name: "Descargar comprobante" })
    .click();
  expect((await download).suggestedFilename()).toBe("comprobante.png");
  await adminPage.getByRole("button", { name: "Rechazar comprobante" }).click();
  await adminPage
    .getByLabel("Motivo del rechazo")
    .fill("Necesitamos un comprobante con el importe visible.");
  await adminPage
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(
    adminPage.locator(".payment-section > .payment-badge"),
  ).toHaveText("Pago rechazado");
  await page.reload();
  await expect(page.getByText(/Motivo del rechazo: Necesitamos/)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "nuevo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF"),
  });
  await page
    .getByRole("button", { name: "Subir nuevo comprobante", exact: true })
    .click();
  await expect(
    page.getByText("Estamos verificando tu transferencia."),
  ).toBeVisible();
  await adminPage.reload();
  await adminPage
    .getByRole("button", { name: "Aprobar pago", exact: true })
    .click();
  await adminPage
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(
    adminPage.locator(".payment-section > .payment-badge"),
  ).toHaveText("Pago aprobado");
  await page.reload();
  await expect(page.locator(".payment-section > .payment-badge")).toHaveText(
    "Pago aprobado",
  );
  await expect(page.locator(".receipt-history")).toHaveCount(2);
  await adminPage.goto("/admin/pedidos");
  await adminPage
    .getByLabel("Método de pago", { exact: true })
    .selectOption("TRANSFERENCIA");
  await adminPage.getByLabel("Buscar pedido o cliente").fill(`pagos-${suffix}`);
  await expect(adminPage.locator("tbody tr")).toHaveCount(1);
  await adminPage.reload();
  await expect(
    adminPage.getByLabel("Método de pago", { exact: true }),
  ).toHaveValue("TRANSFERENCIA");
  await adminPage.setViewportSize({ width: 768, height: 1024 });
  expect(
    await adminPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await adminPage.screenshot({
    path: "test-results/payments-admin-tablet.png",
    fullPage: true,
  });
  await adminPage.goto("/admin/pagos");
  await adminPage.getByLabel("Alias bancario").fill("alias.prueba.mp");
  await adminPage.getByLabel("Porcentaje de descuento").fill("4");
  await adminPage
    .getByRole("button", { name: "Guardar configuración" })
    .click();
  await expect(
    adminPage.getByText("Configuración de pagos guardada."),
  ).toBeVisible();
  await adminPage.reload();
  await expect(adminPage.getByLabel("Alias bancario")).toHaveValue(
    "alias.prueba.mp",
  );
  await adminApi.put("/api/admin/payment-settings", {
    data: { bank_alias: "emilio.joa.mp", cash_discount_percentage: 3 },
  });
  expect(errors).toEqual([]);
  await adminContext.close();
  await adminApi.dispose();
});
