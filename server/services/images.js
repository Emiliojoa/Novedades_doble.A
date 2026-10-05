import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { assert } from "../utils/errors.js";
const bucket = "doble-a-products";
export async function saveImage(buffer, extension, localDir) {
  const filename = `${randomUUID()}.${extension}`;
  if (!process.env.SUPABASE_URL) {
    await writeFile(path.join(localDir, filename), buffer);
    return `/uploads/${filename}`;
  }
  const base = process.env.SUPABASE_URL.replace(/\/$/, "");
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.API_KEY_SUPABASE;
  assert(secret, 503, "Falta configurar la clave de Storage en el backend.");
  const headers = {
    apikey: secret,
    ...(secret.startsWith("eyJ")
      ? {
          Authorization: `Bearer ${secret}`,
        }
      : {}),
  };
  const existing = await fetch(`${base}/storage/v1/bucket/${bucket}`, {
    headers,
  });
  if (!existing.ok) {
    const result = await fetch(`${base}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: bucket,
        name: bucket,
        public: true,
        file_size_limit: 5242880,
        allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
      }),
    });
    assert(
      result.ok || result.status === 409,
      502,
      "No se pudo preparar el almacenamiento de imágenes.",
    );
  }
  const result = await fetch(
    `${base}/storage/v1/object/${bucket}/${filename}`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": `image/${extension === "jpg" ? "jpeg" : extension}`,
      },
      body: buffer,
    },
  );
  assert(result.ok, 502, "No se pudo guardar la imagen en Supabase Storage.");
  return `${base}/storage/v1/object/public/${bucket}/${filename}`;
}
