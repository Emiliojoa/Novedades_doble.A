import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";

test("Diseño con imagen, medidas en cm y cantidad llega a administración", async ({
  page,
}) => {
  const response = await page.request.post("/api/auth/register", {
    data: {
      first_name: "Cliente",
      last_name: "Diseño",
      email: `quote-${Date.now()}@example.test`,
      password: randomBytes(24).toString("hex"),
    },
  });
  expect(response.status()).toBe(201);
  await page.goto("/impresiones-3d#personalizado");
  await page.getByLabel("Nombre del diseño").fill("Organizador con referencia");
  await page.getByLabel("Tu WhatsApp").fill("+54 9 11 1234 5678");
  const upload = page.getByLabel("Imagen de referencia");
  await upload.setInputFiles({
    name: "incorrecto.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("incorrecto"),
  });
  await expect(page.getByRole("alert")).toContainText("hasta 5 MB");
  await upload.setInputFiles({
    name: "referencia.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByAltText("Vista previa de tu imagen de referencia"),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText("Vista previa de tu imagen de referencia")
        .evaluate((img) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByLabel("Ancho en centímetros").fill("12.5");
  await page.getByLabel("Alto en centímetros").fill("8");
  await page.getByLabel("Profundidad en centímetros").fill("4");
  await page.getByLabel("Cantidad de unidades").fill("3");
  await page
    .getByLabel("¿Qué te gustaría crear?")
    .fill("Un organizador azul para guardar mis cables.");
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .locator(".quote-form")
      .screenshot({ path: `artifacts/quote-${width}.png` });
  }
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByRole("status")).toContainText("Solicitud enviada");
  const quotes = await (await page.request.get("/api/quotes")).json();
  const quote = quotes.find((q) => q.name === "Organizador con referencia");
  expect(quote.quantity).toBe(3);
  expect(quote.phone).toBe("+5491112345678");
  expect(quote.description).toContain("ancho 12.5 × alto 8 × profundidad 4");
  expect(quote.reference).toMatch(/^\/uploads\/[a-f0-9-]+\.png$/);
  try {
    expect((await page.request.get(quote.reference)).status()).toBe(200);
    await page.goto("/perfil");
    await expect(
      page.getByRole("link", { name: "Ver referencia" }),
    ).toBeVisible();
    await page.request.post("/api/auth/login", {
      data: {
        email: "admin@example.test",
        password: process.env.E2E_ADMIN_PASSWORD,
      },
    });
    await page.goto("/admin/solicitudes");
    const whatsapp = page.getByRole("link", {
      name: "Abrir WhatsApp de Cliente Diseño",
    });
    const whatsappUrl = new URL(await whatsapp.getAttribute("href"));
    expect(whatsappUrl.origin + whatsappUrl.pathname).toBe(
      "https://wa.me/5491112345678",
    );
    expect(whatsappUrl.searchParams.get("text")).toContain(
      "Organizador con referencia",
    );
    await expect(whatsapp).toHaveAttribute("target", "_blank");
    await page.screenshot({
      path: "artifacts/quote-whatsapp-mobile.png",
      fullPage: true,
    });
    await expect(
      page.getByText("Organizador con referencia", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Medidas \(cm\): ancho 12.5/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver referencia" }),
    ).toHaveAttribute("href", quote.reference);
  } finally {
    await unlink(new URL(`../server${quote.reference}`, import.meta.url));
  }
});
