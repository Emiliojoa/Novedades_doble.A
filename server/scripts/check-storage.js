import assert from "node:assert/strict";
import { saveImage } from "../services/images.js";
const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SECRET_KEY || process.env.API_KEY_SUPABASE;
if (!base || !key)
  throw new Error(
    "Configurar SUPABASE_URL y SUPABASE_SECRET_KEY en server/.env.",
  );
let url;
try {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhN8AAAAASUVORK5CYII=",
    "base64",
  );
  url = await saveImage(png, "png", "");
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/png/);
  console.log(
    "Supabase Storage: carga y lectura pública de imagen verificadas.",
  );
} catch (error) {
  console.error("Verificación Storage fallida:", error.message);
  process.exitCode = 1;
} finally {
  if (url) {
    const filename = new URL(url).pathname.split("/").pop();
    assert.match(filename, /^[a-f0-9-]+\.png$/);
    const response = await fetch(`${base}/storage/v1/object/doble-a-products`, {
      method: "DELETE",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ prefixes: [filename] }),
    });
    if (!response.ok) {
      console.error("No se pudo eliminar la imagen temporal:", filename);
      process.exitCode = 1;
    } else console.log("Imagen temporal eliminada.");
  }
}
