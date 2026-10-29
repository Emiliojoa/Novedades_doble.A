import test, { after, before } from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_PROVIDER = "sqlite";
process.env.DATABASE_PATH = ":memory:";
delete process.env.SUPABASE_URL;
const { uploadReceipt, readReceipt, removeDraft } =
  await import("../services/receipts.js");
const { store } = await import("../repositories/store.js");
const { closeDatabase } = await import("../config/database.js");
const pdf = Buffer.from("%PDF-1.4\n%%EOF");
const file = {
  buffer: pdf,
  originalname: "comprobante.pdf",
  mimetype: "application/pdf",
};
const original = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SECRET_KEY,
  mode: process.env.NODE_ENV,
};
before(async () => {
  await store.run(
    "INSERT INTO users(id,first_name,last_name,email,password_hash) VALUES(1,'Storage','Test','storage@example.test','unused')",
  );
  process.env.SUPABASE_URL = "https://storage.example.test";
  process.env.SUPABASE_SECRET_KEY = "test-only-storage-secret";
});
after(async () => {
  for (const [key, value] of [
    ["SUPABASE_URL", original.url],
    ["SUPABASE_SECRET_KEY", original.key],
    ["NODE_ENV", original.mode],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await closeDatabase();
});
test("Supabase: un bucket público se rechaza antes de guardar datos privados", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ public: true }),
  );
  await assert.rejects(uploadReceipt(file, { id: 1 }), { status: 503 });
  assert.equal(
    (await store.one("SELECT COUNT(*) count FROM payment_receipts")).count,
    0,
  );
});
test("Supabase: crear bucket privado, guardar, recuperar con autorización y borrar borradores", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, ...options });
    if (url.includes("/bucket/")) return new Response(null, { status: 404 });
    if (url.endsWith("/bucket")) return Response.json({});
    if (options.method === "POST" || options.method === "DELETE")
      return Response.json({});
    return new Response(pdf, {
      headers: { "Content-Type": "application/pdf" },
    });
  });
  const receipt = await uploadReceipt(file, { id: 1 });
  const bucketCall = calls.find((c) => c.url.endsWith("/bucket"));
  assert.equal(JSON.parse(bucketCall.body).public, false);
  assert.equal(JSON.parse(bucketCall.body).file_size_limit, 5242880);
  assert.equal(
    calls.find((c) => c.body === pdf).headers.apikey,
    "test-only-storage-secret",
  );
  const stored = await store.one(
    "SELECT * FROM payment_receipts WHERE id=?",
    receipt.id,
  );
  assert.equal(stored.local_content, null);
  const order = Number(
    (await store.run("INSERT INTO orders(user_id,total) VALUES(1,5000000)"))
      .lastInsertRowid,
  );
  await store.run(
    "UPDATE payment_receipts SET order_id=? WHERE id=?",
    order,
    receipt.id,
  );
  assert.deepEqual((await readReceipt(receipt.id, { id: 1 })).content, pdf);
  assert.ok(calls.some((c) => c.url.includes("/object/authenticated/")));
  await assert.rejects(readReceipt(receipt.id, { id: 2 }), { status: 404 });
  const draft = await uploadReceipt(file, { id: 1 });
  await removeDraft(draft.id, { id: 1 });
  assert.ok(calls.some((c) => c.method === "DELETE"));
  assert.equal(
    await store.one("SELECT id FROM payment_receipts WHERE id=?", draft.id),
    undefined,
  );
});
test("Supabase: maneja 404 y conflicto 409 envueltos en HTTP 400 sin bucles", async (t) => {
  let lookups = 0,
    creates = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.includes("/bucket/")) {
      lookups++;
      return lookups === 1
        ? Response.json(
            { statusCode: "404", error: "Bucket not found" },
            { status: 400 },
          )
        : Response.json({ public: false });
    }
    if (url.endsWith("/bucket")) {
      creates++;
      return Response.json(
        { statusCode: "409", error: "Duplicate" },
        { status: 400 },
      );
    }
    return Response.json({});
  });
  const draft = await uploadReceipt(file, { id: 1 });
  assert.equal(lookups, 2);
  assert.equal(creates, 1);
  await removeDraft(draft.id, { id: 1 });
  t.mock.method(globalThis, "fetch", async (url) =>
    Response.json(
      { statusCode: url.endsWith("/bucket") ? "409" : "404" },
      { status: 400 },
    ),
  );
  await assert.rejects(uploadReceipt(file, { id: 1 }), { status: 502 });
});
test("Producción no permite almacenar comprobantes solo en el filesystem o SQLite de Render", async () => {
  delete process.env.SUPABASE_URL;
  process.env.NODE_ENV = "production";
  await assert.rejects(uploadReceipt(file, { id: 1 }), { status: 503 });
});
