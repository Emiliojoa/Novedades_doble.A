import { randomUUID } from "node:crypto";
import path from "node:path";
import { store } from "../repositories/store.js";
import { provider } from "../config/database.js";
import { assert } from "../utils/errors.js";

const configuredLimit = Number(process.env.PAYMENT_RECEIPT_MAX_MB || 5);
assert(
  Number.isInteger(configuredLimit) &&
    configuredLimit >= 1 &&
    configuredLimit <= 20,
  500,
  "PAYMENT_RECEIPT_MAX_MB debe ser un entero de 1 a 20.",
);
export const receiptMaxBytes = configuredLimit * 1024 * 1024;
const bucket =
  process.env.PAYMENT_RECEIPTS_BUCKET || "doble-a-payment-receipts";

export function validateReceipt(file) {
  assert(file?.buffer?.length, 400, "Adjuntá un comprobante JPG, PNG o PDF.");
  const b = file.buffer;
  assert(
    b.length <= receiptMaxBytes,
    400,
    `El comprobante no puede superar ${configuredLimit} MB.`,
  );
  let type;
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    type = ["image/png", ".png"];
  else if (b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255)
    type = ["image/jpeg", ".jpg", ".jpeg"];
  else if (
    b.toString("ascii", 0, 5) === "%PDF-" &&
    b.subarray(-1024).includes(Buffer.from("%%EOF"))
  )
    type = ["application/pdf", ".pdf"];
  const extension = path.extname(file.originalname || "").toLowerCase();
  assert(
    type && type[0] === file.mimetype && type.slice(1).includes(extension),
    400,
    "El contenido, el tipo y la extensión deben corresponder a un JPG, PNG o PDF válido.",
  );
  return { mime: type[0], extension: type[1] };
}
function storageConfig() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.API_KEY_SUPABASE;
  assert(
    base && secret,
    503,
    "Configurá Supabase Storage privado para guardar los comprobantes.",
  );
  return {
    base,
    headers: {
      apikey: secret,
      ...(secret.startsWith("eyJ")
        ? { Authorization: `Bearer ${secret}` }
        : {}),
    },
  };
}
async function storageFetch(url, options) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
}
async function prepareBucket(attempt = 0) {
  const { base, headers } = storageConfig();
  const existing = await storageFetch(`${base}/storage/v1/bucket/${bucket}`, {
    headers,
  });
  // Storage can wrap a 404/409 in an HTTP 400 response.
  const existingData = await existing.json().catch(() => null);
  const missing =
    existing.status === 404 ||
    (existing.status === 400 && Number(existingData?.statusCode) === 404);
  if (missing) {
    const created = await storageFetch(`${base}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: bucket,
        name: bucket,
        public: false,
        file_size_limit: receiptMaxBytes,
        allowed_mime_types: ["image/png", "image/jpeg", "application/pdf"],
      }),
    });
    const createdData = created.ok
      ? null
      : await created.json().catch(() => null);
    const conflict =
      created.status === 409 ||
      (created.status === 400 && Number(createdData?.statusCode) === 409);
    assert(
      created.ok || (conflict && attempt < 1),
      502,
      "No se pudo crear el bucket privado de comprobantes.",
    );
    if (created.ok) return;
    return prepareBucket(attempt + 1);
  }
  assert(
    existing.ok,
    502,
    "No se pudo verificar el bucket privado de comprobantes.",
  );
  assert(
    existingData?.public === false,
    503,
    "El bucket de comprobantes debe ser privado.",
  );
}
// SQLite keeps files in the persistent database, never in public /uploads.
// Render/PostgreSQL always requires private Supabase Storage.
const useDatabase = () =>
  provider === "sqlite" &&
  process.env.NODE_ENV !== "production" &&
  !process.env.SUPABASE_URL;
export async function uploadReceipt(file, user) {
  const { mime, extension } = validateReceipt(file);
  const id = randomUUID(),
    storagePath = `${user.id}/${id}${extension}`;
  const local = useDatabase();
  if (!local) {
    await prepareBucket();
    const { base, headers } = storageConfig();
    const result = await storageFetch(
      `${base}/storage/v1/object/${bucket}/${storagePath}`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": mime },
        body: file.buffer,
      },
    );
    assert(
      result.ok,
      502,
      "No se pudo guardar el comprobante. Intentá nuevamente.",
    );
  }
  try {
    await store.run(
      "INSERT INTO payment_receipts(id,user_id,storage_path,original_filename,mime_type,file_size,local_content) VALUES(?,?,?,?,?,?,?)",
      id,
      user.id,
      storagePath,
      path
        .basename(file.originalname)
        .replace(/[\x00-\x1f]/g, "")
        .slice(0, 200),
      mime,
      file.buffer.length,
      local ? file.buffer.toString("base64") : null,
    );
  } catch (error) {
    if (!local) await removeStored(storagePath).catch(() => {});
    throw error;
  }
  return {
    id,
    original_filename: file.originalname,
    mime_type: mime,
    file_size: file.buffer.length,
  };
}
async function removeStored(storagePath) {
  const { base, headers } = storageConfig();
  const result = await storageFetch(`${base}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [storagePath] }),
  });
  assert(
    result.ok,
    502,
    "No se pudo eliminar el comprobante del almacenamiento.",
  );
}
export async function removeDraft(id, user) {
  await store.transaction(async () => {
    const receipt = await store.one(
      "SELECT * FROM payment_receipts WHERE id=? AND user_id=? AND order_id IS NULL",
      id,
      user.id,
    );
    assert(
      receipt,
      404,
      "Comprobante no encontrado o ya asociado a un pedido.",
    );
    if (!receipt.local_content) await removeStored(receipt.storage_path);
    await store.run(
      "DELETE FROM payment_receipts WHERE id=? AND order_id IS NULL",
      id,
    );
  });
}
export async function readReceipt(id, user) {
  const receipt = await store.one(
    "SELECT r.*,o.user_id owner_id FROM payment_receipts r JOIN orders o ON o.id=r.order_id WHERE r.id=?",
    id,
  );
  assert(
    receipt && (user.role === "ADMIN" || receipt.owner_id === user.id),
    404,
    "Comprobante no encontrado.",
  );
  let content;
  if (receipt.local_content)
    content = Buffer.from(receipt.local_content, "base64");
  else {
    const { base, headers } = storageConfig();
    const result = await storageFetch(
      `${base}/storage/v1/object/authenticated/${bucket}/${receipt.storage_path}`,
      { headers },
    );
    assert(result.ok, 502, "No se pudo recuperar el comprobante.");
    content = Buffer.from(await result.arrayBuffer());
  }
  return { ...receipt, content };
}
