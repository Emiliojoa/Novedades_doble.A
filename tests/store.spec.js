import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
test("Tienda completa: administración, cliente, pedido y responsive", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Tecnología",
  );
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.goto("/admin");
  await expect(page).toHaveURL(/login/);
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page
    .getByRole("button", { name: "Mostrar contraseña", exact: true })
    .click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Ocultar contraseña", exact: true })
    .click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resumen general" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Categorías", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Tecnología de prueba");
  await page.getByRole("button", { name: "Crear categoría" }).click();
  await expect(
    page.getByRole("cell", { name: "Tecnología de prueba", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Auriculares de prueba");
  await page.getByLabel("Precio minorista (ARS)").fill("10000");
  await page.getByLabel("Stock actual").fill("10");
  await page
    .getByRole("combobox", { name: "Categoría", exact: true })
    .selectOption({ label: "Tecnología de prueba" });
  await page
    .getByLabel("Descripción", { exact: true })
    .fill("Producto temporal utilizado únicamente en las pruebas de interfaz.");
  await page.getByLabel("Destacado en inicio").check();
  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(
    page.getByRole("button", { name: "Editar Auriculares de prueba" }),
  ).toBeVisible();
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3011/");
  await page.goto("/productos");
  await page
    .getByRole("link", { name: "Auriculares de prueba", exact: true })
    .click();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByText(
      "Para agregar productos al carrito, iniciá sesión o registrate.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Registrate", exact: true }).click();
  await page
    .getByRole("button", { name: "Mostrar contraseña", exact: true })
    .click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Ocultar contraseña", exact: true })
    .click();
  await page.getByLabel("Nombre", { exact: true }).fill("Cliente");
  await page.getByLabel("Apellido", { exact: true }).fill("Prueba");
  await page
    .getByLabel("Email", { exact: true })
    .fill("cliente-ui@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(randomBytes(20).toString("hex"));
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(
    page.getByRole("heading", { name: "Auriculares de prueba" }),
  ).toBeVisible();
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.getByRole("link", { name: "Ver carrito", exact: true }).click();
  await expect(page.locator(".summary-total")).toContainText(/20\.000/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/cart-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(
    page.getByText("¡Recibimos tu pedido!", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("cliente-ui@example.test")).toBeVisible();
  await page.goto("/impresiones-3d");
  await page.getByLabel("Nombre del diseño").fill("Organizador de prueba");
  await page.getByLabel("Ancho en centímetros").fill("10");
  await page.getByLabel("Alto en centímetros").fill("5");
  await page.getByLabel("Profundidad en centímetros").fill("4");
  await page.getByLabel("Tu WhatsApp").fill("+54 9 11 1234 5678");
  await page
    .getByLabel("¿Qué te gustaría crear?")
    .fill("Un organizador de cables para mi escritorio.");
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(
    page.getByText("Solicitud enviada.", { exact: false }),
  ).toBeVisible();
  for (const route of [
    "/",
    "/productos",
    "/categorias",
    "/perfil",
    "/impresiones-3d",
  ]) {
    await page.goto(route);
    await page
      .locator(".loading")
      .waitFor({ state: "hidden" })
      .catch(() => {});
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
  }
  await page.goto("/");
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(
    page.getByRole("navigation", { name: "Navegación principal" }),
  ).toBeVisible();
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3011/");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  await page.goto("/admin/pedidos");
  await page.getByRole("link", { name: "Ver", exact: true }).click();
  await expect(page.getByText("cliente-ui@example.test")).toBeVisible();
  await page.getByRole("button", { name: "Confirmado", exact: true }).click();
  await expect(
    page.locator("span").filter({ hasText: /^Confirmado$/ }),
  ).toBeVisible();
  for (const route of [
    "/admin",
    "/admin/productos",
    "/admin/stock",
    "/admin/categorias",
    "/admin/clientes",
    "/admin/solicitudes",
  ]) {
    await page.goto(route);
    await page
      .locator(".loading")
      .waitFor({ state: "hidden" })
      .catch(() => {});
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
  }
  await page.goto("/admin");
  await page.screenshot({
    path: "test-results/admin-mobile.png",
    fullPage: true,
  });
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/productos",
      "/impresiones-3d",
      "/admin/productos",
      "/admin/stock",
    ]) {
      await page.goto(route);
      await expect(page.locator(".loading")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
