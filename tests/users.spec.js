import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

test("Administración crea, busca, edita, cambia contraseña y elimina usuarios", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.request.post("/api/auth/login", {
    data: {
      email: "admin@example.test",
      password: process.env.E2E_ADMIN_PASSWORD,
    },
  });
  await page.goto("/admin");
  await page.getByRole("link", { name: "Usuarios", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Usuarios", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Crear usuario" }).click();
  const dialog = page.getByRole("dialog");
  const password = randomBytes(24).toString("hex");
  await dialog.getByLabel("Nombre", { exact: true }).fill("Lucía");
  await dialog.getByLabel("Apellido", { exact: true }).fill("Pérez");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("managed-ui@example.test");
  await dialog.getByLabel("Teléfono (opcional)").fill("+54 9 11 1234 5678");
  await dialog.getByLabel("Contraseña inicial").fill(password);
  await dialog.getByLabel("Confirmar contraseña").fill(password);
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".success[role=status]")).toContainText(
    "Cuenta creada",
  );
  expect((await (await page.request.get("/api/auth/me")).json()).role).toBe(
    "ADMIN",
  );
  await page.getByLabel("Buscar usuario").fill("lucia");
  let row = page.getByRole("article", {
    name: "Usuario managed-ui@example.test",
  });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Editar", exact: true }).click();
  await dialog.getByLabel("Nombre", { exact: true }).fill("Luciana");
  await dialog.getByLabel("Teléfono (opcional)").fill("1199998888");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("updated-ui@example.test");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  row = page.getByRole("article", { name: "Usuario updated-ui@example.test" });
  await expect(row).toContainText("1199998888");
  await row.getByRole("button", { name: "Contraseña", exact: true }).click();
  const changed = randomBytes(24).toString("hex");
  await dialog.getByLabel("Nueva contraseña").fill(changed);
  await dialog.getByLabel("Confirmar contraseña").fill(password);
  await dialog.getByRole("button", { name: "Actualizar contraseña" }).click();
  await expect(dialog.getByRole("alert")).toContainText("no coinciden");
  await dialog.getByLabel("Confirmar contraseña").fill(changed);
  await dialog.getByRole("button", { name: "Actualizar contraseña" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".success[role=status]")).toContainText(
    "Contraseña actualizada",
  );
  await page.getByLabel("Buscar usuario").fill("");
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/users-${width}.png`,
      fullPage: true,
    });
  }
  await row.getByRole("button", { name: "Editar", exact: true }).click();
  await dialog.screenshot({ path: "artifacts/users-edit-mobile.png" });
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await row.getByRole("button", { name: "Eliminar", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Eliminar", exact: true }).click();
  await dialog.getByRole("button", { name: "Eliminar cuenta" }).click();
  await expect(row).toHaveCount(0);
  await expect(page.locator(".success[role=status]")).toContainText(
    "Cuenta eliminada",
  );
  await expect(
    page
      .getByRole("article", { name: "Usuario admin@example.test" })
      .getByRole("button", { name: "Eliminar", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
