import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { paymentAmounts } from "../../shared/payments.js";
process.env.DATABASE_PROVIDER = "sqlite";
process.env.DATABASE_PATH = ":memory:";
delete process.env.SUPABASE_URL;
const { app } = await import("../app.js");
const { store } = await import("../repositories/store.js");
const { closeDatabase } = await import("../config/database.js");
const { createSession } = await import("../services/auth.js");
let server,
  base,
  admin,
  client,
  other,
  product,
  cashOrder,
  transferOrder,
  firstReceipt;
async function call(route, { cookie = client, method = "GET", body } = {}) {
  const response = await fetch(`${base}/api${route}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get("content-type") || "";
  return {
    status: response.status,
    headers: response.headers,
    data: type.includes("application/json")
      ? await response.json()
      : Buffer.from(await response.arrayBuffer()),
  };
}
async function cart(cookie = client, quantity = 1) {
  return call("/cart/items", {
    cookie,
    method: "POST",
    body: { product_id: product, quantity },
  });
}
function checkout(method = "EFECTIVO", extra = {}) {
  return {
    payment_method: method,
    idempotency_key: randomUUID(),
    expected_subtotal: 5000000,
    expected_total: method === "EFECTIVO" ? 4850000 : 5000000,
    ...extra,
  };
}
async function upload(
  cookie = client,
  content = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
  name = "transferencia.pdf",
  type = "application/pdf",
) {
  const body = new FormData();
  body.append("receipt", new Blob([content], { type }), name);
  return call("/payment-receipts", { cookie, method: "POST", body });
}
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [index, role] of [
    [1, "ADMIN"],
    [2, "CLIENT"],
    [3, "CLIENT"],
  ]) {
    await store.run(
      "INSERT INTO users(id,first_name,last_name,email,password_hash,role) VALUES(?,?,?,?,?,?)",
      index,
      "Pagos",
      String(index),
      `pagos${index}@example.test`,
      "unused",
      role,
    );
    const cookie = `session=${await createSession(index)}`;
    if (index === 1) admin = cookie;
    else if (index === 2) client = cookie;
    else other = cookie;
  }
  const category = (
    await store.run(
      "INSERT INTO categories(name) VALUES(?)",
      "Pruebas de pagos",
    )
  ).lastInsertRowid;
  product = Number(
    (
      await store.run(
        "INSERT INTO products(name,price,stock,category_id) VALUES(?,?,?,?)",
        "Compra de $50.000",
        5000000,
        20,
        category,
      )
    ).lastInsertRowid,
  );
});
after(async () => {
  await new Promise((r) => server.close(r));
  await closeDatabase();
});

test("Importes exactos en centavos y cambio de método sin acumular descuentos", () => {
  assert.deepEqual(paymentAmounts(5000000, 3), {
    subtotal: 5000000,
    discount_percentage: 3,
    discount_amount: 150000,
    total: 4850000,
  });
  assert.equal(paymentAmounts(5000000, 0).total, 5000000);
  assert.equal(paymentAmounts(50, 3).discount_amount, 2);
  assert.equal(paymentAmounts(Number.MAX_SAFE_INTEGER, 100).total, 0);
});
test("Checkout exige método, valores vigentes e idempotencia; rechaza totales manipulados", async () => {
  await cart();
  for (const body of [
    {},
    { ...checkout(), total: 1 },
    checkout("EFECTIVO", { expected_total: 1 }),
    checkout("TRANSFERENCIA"),
  ]) {
    const r = await call("/orders", { method: "POST", body });
    assert.ok([400, 409].includes(r.status), JSON.stringify(r));
  }
  assert.equal((await call("/cart")).data.items.length, 1);
  assert.equal((await store.one("SELECT COUNT(*) count FROM orders")).count, 0);
});
test("Efectivo: descuento en backend, snapshot, doble clic y recuperación después de vaciar carrito", async () => {
  const body = checkout();
  const replies = await Promise.all([
    call("/orders", { method: "POST", body }),
    call("/orders", { method: "POST", body }),
  ]);
  assert.deepEqual(
    replies.map((r) => r.status),
    [201, 201],
  );
  cashOrder = replies[0].data;
  assert.equal(cashOrder.id, replies[1].data.id);
  assert.equal(cashOrder.total, 4850000);
  assert.equal(cashOrder.discount_amount, 150000);
  assert.equal(cashOrder.payment_status, "PENDING_PAYMENT");
  assert.equal(cashOrder.items[0].unit_price, 5000000);
  assert.equal(
    (await store.one("SELECT stock FROM products WHERE id=?", product)).stock,
    19,
  );
  assert.equal(
    (await call("/orders", { method: "POST", body })).data.id,
    cashOrder.id,
  );
  assert.equal(
    (
      await call("/orders", {
        method: "POST",
        body: { ...body, expected_total: 1 },
      })
    ).status,
    409,
  );
});
test("Solo administración puede confirmar efectivo; registra actor, fecha y auditoría una vez", async () => {
  const body = { status: "APPROVED", expected_status: "PENDING_PAYMENT" };
  assert.equal(
    (
      await call(`/admin/orders/${cashOrder.id}/payment`, {
        method: "PATCH",
        body,
      })
    ).status,
    403,
  );
  const result = await call(`/admin/orders/${cashOrder.id}/payment`, {
    cookie: admin,
    method: "PATCH",
    body,
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.payment_status, "APPROVED");
  assert.equal(result.data.payment_approved_by, 1);
  assert.ok(result.data.payment_approved_at);
  assert.equal(result.data.status, "PENDIENTE");
  assert.equal(
    result.data.payment_history.filter((h) => h.action === "PAYMENT_APPROVED")
      .length,
    1,
  );
  assert.equal(
    (
      await call(`/admin/orders/${cashOrder.id}/payment`, {
        cookie: admin,
        method: "PATCH",
        body,
      })
    ).status,
    409,
  );
});
test("Comprobantes: autorización, extensión, firma, MIME y límite de 5 MB", async () => {
  assert.equal((await upload("", "not a PDF")).status, 401);
  assert.equal((await upload(client, "texto falso")).status, 400);
  assert.equal(
    (await upload(client, "%PDF-1.4\n%%EOF", "mal.exe")).status,
    400,
  );
  assert.equal(
    (await upload(client, "%PDF-1.4\n%%EOF", "mal.pdf", "image/png")).status,
    400,
  );
  assert.equal(
    (await upload(client, Buffer.alloc(5242881), "grande.pdf")).status,
    400,
  );
  const result = await upload();
  assert.equal(result.status, 201);
  firstReceipt = result.data;
});
test("Transferencia: comprobante obligatorio, propietario, stock atómico y alias correcto", async () => {
  await cart();
  const body = checkout("TRANSFERENCIA", {
    receipt_id: firstReceipt.id,
    bank_alias: "emilio.joa.mp",
  });
  await cart(other);
  assert.equal(
    (await call("/orders", { cookie: other, method: "POST", body })).status,
    400,
  );
  assert.equal((await call("/cart", { cookie: other })).data.items.length, 1);
  assert.equal(
    (await store.one("SELECT stock FROM products WHERE id=?", product)).stock,
    19,
  );
  const reply = await call("/orders", { method: "POST", body });
  assert.equal(reply.status, 201);
  transferOrder = reply.data;
  assert.equal(transferOrder.payment_status, "PENDING_VERIFICATION");
  assert.equal(transferOrder.total, 5000000);
  assert.equal(transferOrder.discount_amount, 0);
  assert.equal(transferOrder.payment_alias_snapshot, "emilio.joa.mp");
  assert.equal(transferOrder.receipts[0].id, firstReceipt.id);
  assert.ok(!JSON.stringify(transferOrder).includes("local_content"));
  assert.ok(!JSON.stringify(transferOrder).includes("storage_path"));
});
test("Comprobantes privados: solo propietario o ADMIN, nunca públicos; persisten en DB", async () => {
  for (const cookie of [client, admin]) {
    const r = await call(`/payment-receipts/${firstReceipt.id}`, { cookie });
    assert.equal(r.status, 200);
    assert.match(r.data.toString(), /%PDF-/);
    assert.match(r.headers.get("cache-control"), /no-store/);
  }
  assert.equal(
    (await call(`/payment-receipts/${firstReceipt.id}`, { cookie: other }))
      .status,
    404,
  );
  assert.equal(
    (await call(`/payment-receipts/${firstReceipt.id}`, { cookie: "" })).status,
    401,
  );
  assert.equal(
    (await call(`/payment-receipts/${firstReceipt.id}`, { method: "DELETE" }))
      .status,
    404,
  );
  const stored = await store.one(
    "SELECT local_content FROM payment_receipts WHERE id=?",
    firstReceipt.id,
  );
  assert.ok(stored.local_content);
});
test("Rechazo exige motivo; nuevo comprobante conserva el historial y evita revisar uno obsoleto", async () => {
  const route = `/admin/orders/${transferOrder.id}/payment`;
  const body = {
    status: "REJECTED",
    expected_status: "PENDING_VERIFICATION",
    receipt_id: firstReceipt.id,
  };
  assert.equal(
    (await call(route, { cookie: admin, method: "PATCH", body })).status,
    400,
  );
  assert.equal(
    (
      await call(route, {
        cookie: admin,
        method: "PATCH",
        body: { ...body, reason: "No figura el ingreso." },
      })
    ).data.payment_status,
    "REJECTED",
  );
  const replacement = (await upload()).data;
  assert.equal(
    (
      await call(`/orders/${transferOrder.id}/receipts`, {
        cookie: other,
        method: "POST",
        body: { receipt_id: replacement.id },
      })
    ).status,
    404,
  );
  const resubmitted = await call(`/orders/${transferOrder.id}/receipts`, {
    method: "POST",
    body: { receipt_id: replacement.id },
  });
  assert.equal(resubmitted.status, 200);
  assert.equal(resubmitted.data.payment_status, "PENDING_VERIFICATION");
  assert.equal(resubmitted.data.receipts.length, 2);
  assert.equal(
    resubmitted.data.receipts.find((r) => r.id === firstReceipt.id)
      .rejection_reason,
    "No figura el ingreso.",
  );
  assert.equal(
    (
      await call(route, {
        cookie: admin,
        method: "PATCH",
        body: { ...body, status: "APPROVED" },
      })
    ).status,
    409,
  );
  const approved = await call(route, {
    cookie: admin,
    method: "PATCH",
    body: { ...body, status: "APPROVED", receipt_id: replacement.id },
  });
  assert.equal(approved.data.payment_status, "APPROVED");
  const refreshed = (await call(`/orders/${transferOrder.id}`)).data;
  assert.equal(refreshed.payment_status, "APPROVED");
  assert.equal(refreshed.receipts.length, 2);
  assert.equal(refreshed.payment_history.length, 4);
});
test("Configuración persistente y protegida; compras históricas conservan condiciones", async () => {
  assert.equal(
    (await call("/admin/payment-settings", { cookie: null })).status,
    401,
  );
  assert.equal((await call("/admin/payment-settings")).status, 403);
  assert.equal(
    (await call("/admin/payment-settings", { cookie: admin })).status,
    200,
  );
  const body = { bank_alias: "nuevo.alias.mp", cash_discount_percentage: 5 };
  assert.equal(
    (await call("/admin/payment-settings", { method: "PUT", body })).status,
    403,
  );
  assert.equal(
    (
      await call("/admin/payment-settings", {
        cookie: admin,
        method: "PUT",
        body: { ...body, cash_discount_percentage: 101 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/admin/payment-settings", {
        cookie: admin,
        method: "PUT",
        body,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/payment-settings")).data.bank_alias,
    body.bank_alias,
  );
  assert.equal(
    (await call(`/orders/${cashOrder.id}`)).data.discount_percentage,
    3,
  );
  assert.equal(
    (await call(`/orders/${transferOrder.id}`)).data.payment_alias_snapshot,
    "emilio.joa.mp",
  );
  await cart();
  assert.equal(
    (await call("/orders", { method: "POST", body: checkout() })).status,
    409,
  );
  const next = await call("/orders", {
    method: "POST",
    body: checkout("EFECTIVO", { expected_total: 4750000 }),
  });
  assert.equal(next.status, 201);
  assert.equal(next.data.discount_percentage, 5);
});
test("Administración: filtros, búsqueda, paginación y contadores reales", async () => {
  assert.equal((await call("/admin/payments")).status, 403);
  const result = await call(
    "/admin/payments?payment_method=TRANSFERENCIA&payment_status=APPROVED&search=pagos2&limit=1&page=1",
    { cookie: admin },
  );
  assert.equal(result.status, 200);
  assert.equal(result.data.total, 1);
  assert.equal(result.data.orders[0].id, transferOrder.id);
  assert.equal(result.data.counters.pending_payment, 1);
  assert.equal(
    (await call("/admin/payments?page=-1", { cookie: admin })).status,
    400,
  );
});
test("Cancelación mantiene estado de pago y devuelve stock una sola vez; no se cobra cancelado", async () => {
  const pending = (await call("/orders")).data.find(
    (o) => o.payment_status === "PENDING_PAYMENT",
  );
  const stock = (
    await store.one("SELECT stock FROM products WHERE id=?", product)
  ).stock;
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await call(`/admin/orders/${pending.id}/status`, {
          cookie: admin,
          method: "PATCH",
          body: { status: "CANCELADO" },
        })
      ).status,
      200,
    );
  assert.equal(
    (await store.one("SELECT stock FROM products WHERE id=?", product)).stock,
    stock + 1,
  );
  assert.equal(
    (await call(`/orders/${pending.id}`)).data.payment_status,
    "PENDING_PAYMENT",
  );
  assert.equal(
    (
      await call(`/admin/orders/${pending.id}/payment`, {
        cookie: admin,
        method: "PATCH",
        body: { status: "APPROVED", expected_status: "PENDING_PAYMENT" },
      })
    ).status,
    409,
  );
});
