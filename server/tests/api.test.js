import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
process.env.DATABASE_PROVIDER = "sqlite";
process.env.DATABASE_PATH = ":memory:";
delete process.env.SUPABASE_URL;
const { app } = await import("../app.js");
const { store } = await import("../repositories/store.js");
const { closeDatabase } = await import("../config/database.js");
const { hashPassword } = await import("../services/auth.js");
let server, base, admin, client, other, product, category, subcategory, order;
const password = randomBytes(24).toString("hex");
async function call(path, { cookie, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    headers: response.headers,
  };
}
const productData = {
  name: "Producto de prueba",
  description: "Exclusivo para pruebas automatizadas.",
  price: 1000000,
  stock: 8,
  min_stock: 3,
  image: "",
  category_id: 0,
  subcategory_id: null,
  type: "PRODUCTO",
  active: true,
  featured: true,
};
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  await store.run(
    "INSERT INTO users(first_name,last_name,email,password_hash,role) VALUES(?,?,?,?,'ADMIN')",
    "Admin",
    "Test",
    "admin@example.test",
    await hashPassword(password),
  );
  admin = (
    await call("/auth/login", {
      method: "POST",
      body: { email: "admin@example.test", password },
    })
  ).cookie;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await closeDatabase();
});
test("Visitantes no pueden acceder al carrito ni crear pedidos", async () => {
  for (const [path, method] of [
    ["/cart", "GET"],
    ["/cart/items", "POST"],
    ["/orders", "POST"],
    ["/admin/stats", "GET"],
    ["/products", "POST"],
  ])
    assert.equal((await call(path, { method })).status, 401);
  assert.deepEqual((await call("/products")).data, []);
});
test("Registro estricto, contraseñas hasheadas y sesiones persistentes", async () => {
  const data = {
    first_name: "Ana",
    last_name: "Cliente",
    email: "ana@example.test",
    password,
  };
  assert.equal(
    (
      await call("/auth/register", {
        method: "POST",
        body: { ...data, role: "ADMIN" },
      })
    ).status,
    400,
  );
  const r = await call("/auth/register", { method: "POST", body: data });
  assert.equal(r.status, 201);
  client = r.cookie;
  assert.equal(r.data.role, "CLIENT");
  assert.ok(!r.data.password_hash);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  assert.match(r.headers.get("set-cookie"), /SameSite=Lax/);
  assert.equal(
    (await call("/auth/me", { cookie: client })).data.email,
    data.email,
  );
  assert.notEqual(
    (
      await store.one(
        "SELECT password_hash FROM users WHERE email=?",
        data.email,
      )
    ).password_hash,
    password,
  );
  assert.equal(
    (await call("/auth/register", { method: "POST", body: data })).status,
    409,
  );
  other = (
    await call("/auth/register", {
      method: "POST",
      body: { ...data, email: "otra@example.test" },
    })
  ).cookie;
  assert.equal(
    (
      await call("/auth/login", {
        method: "POST",
        body: { email: data.email, password: "incorrecta" },
      })
    ).status,
    401,
  );
});
test("CLIENT no puede modificar catálogo ni acceder a administración", async () => {
  for (const [path, method] of [
    ["/products", "POST"],
    ["/categories", "POST"],
    ["/admin/stock", "GET"],
    ["/admin/orders", "GET"],
    ["/admin/customers", "GET"],
    ["/admin/quotes", "GET"],
    ["/uploads", "POST"],
  ])
    assert.equal((await call(path, { method, cookie: client })).status, 403);
  assert.equal(
    (
      await call("/auth/logout", {
        method: "POST",
        cookie: client,
        headers: { Origin: "https://untrusted.example" },
      })
    ).status,
    403,
  );
});
test("ADMIN crea categorías y productos; valida relaciones y precios", async () => {
  category = (
    await call("/categories", {
      method: "POST",
      cookie: admin,
      body: { name: "Tecnología" },
    })
  ).data;
  subcategory = (
    await call("/categories", {
      method: "POST",
      cookie: admin,
      body: { name: "Cables", parent_id: category.id },
    })
  ).data;
  productData.category_id = category.id;
  productData.subcategory_id = subcategory.id;
  assert.equal(
    (
      await call("/products", {
        method: "POST",
        cookie: admin,
        body: { ...productData, price: -1 },
      })
    ).status,
    400,
  );
  const r = await call("/products", {
    method: "POST",
    cookie: admin,
    body: productData,
  });
  assert.equal(r.status, 201);
  product = r.data;
  assert.equal(
    (await call("/products?search=prueba&sort=price_asc")).data.length,
    1,
  );
  assert.equal(
    (
      await call("/categories/" + category.id, {
        method: "DELETE",
        cookie: admin,
      })
    ).status,
    409,
  );
  assert.equal((await call("/products/not-a-number")).status, 400);
});
test("Carrito aislado por usuario y validación de cantidades y precios", async () => {
  const r = await call("/cart/items", {
    method: "POST",
    cookie: client,
    body: { product_id: product.id, quantity: 2 },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.total, 2000000);
  assert.equal((await call("/cart", { cookie: other })).data.items.length, 0);
  const item = r.data.items[0];
  assert.equal(
    (
      await call(`/cart/items/${item.id}`, {
        method: "PUT",
        cookie: other,
        body: { quantity: 1 },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call("/cart/items", {
        method: "POST",
        cookie: client,
        body: { product_id: product.id, quantity: 1, price: 1 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/cart/items", {
        method: "POST",
        cookie: client,
        body: { product_id: product.id, quantity: 99 },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(`/cart/items/${item.id}`, {
        method: "PUT",
        cookie: client,
        body: { quantity: 0 },
      })
    ).status,
    400,
  );
});
test("Pedido asociado al cliente, precio histórico y vaciado de carrito", async () => {
  const r = await call("/orders", {
    method: "POST",
    cookie: client,
    body: { total: 1 },
  });
  assert.equal(r.status, 201);
  order = r.data;
  assert.equal(order.total, 2000000);
  assert.equal(order.email, "ana@example.test");
  assert.equal(order.items[0].unit_price, 1000000);
  assert.equal((await call("/cart", { cookie: client })).data.items.length, 0);
  assert.equal((await call(`/products/${product.id}`)).data.stock, 6);
  await call(`/products/${product.id}`, {
    method: "PUT",
    cookie: admin,
    body: { ...productData, price: 1200000, stock: 6 },
  });
  assert.equal(
    (await call(`/orders/${order.id}`, { cookie: client })).data.items[0]
      .unit_price,
    1000000,
  );
  assert.equal(
    (await call(`/orders/${order.id}`, { cookie: other })).status,
    404,
  );
  assert.equal(
    (await call(`/orders/${order.id}`, { cookie: admin })).data.email,
    "ana@example.test",
  );
});
test("Cancelación devuelve stock una sola vez y no admite reapertura", async () => {
  assert.equal(
    (
      await call(`/admin/orders/${order.id}/status`, {
        cookie: client,
        method: "PATCH",
        body: { status: "CANCELADO" },
      })
    ).status,
    403,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await call(`/admin/orders/${order.id}/status`, {
          cookie: admin,
          method: "PATCH",
          body: { status: "CANCELADO" },
        })
      ).status,
      200,
    );
  assert.equal((await call(`/products/${product.id}`)).data.stock, 8);
  assert.equal(
    (
      await call(`/admin/orders/${order.id}/status`, {
        cookie: admin,
        method: "PATCH",
        body: { status: "CONFIRMADO" },
      })
    ).status,
    409,
  );
});
test("Compras simultáneas no venden por encima del stock", async () => {
  await call(`/products/${product.id}`, {
    method: "PUT",
    cookie: admin,
    body: { ...productData, stock: 1 },
  });
  for (const cookie of [client, other])
    assert.equal(
      (
        await call("/cart/items", {
          method: "POST",
          cookie,
          body: { product_id: product.id, quantity: 1 },
        })
      ).status,
      200,
    );
  const results = await Promise.all(
    [client, other].map((cookie) =>
      call("/orders", { method: "POST", cookie }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await call(`/products/${product.id}`)).data.stock, 0);
});
test("Presupuestos 3D vinculados al cliente y estados administrativos", async () => {
  const r = await call("/quotes", {
    method: "POST",
    cookie: client,
    body: {
      name: "Organizador",
      phone: "+54 9 11 1234 5678",
      description: "Organizador para cables a medida.",
      quantity: 2,
      reference: "",
    },
  });
  assert.equal(r.status, 201);
  assert.equal((await call("/quotes", { cookie: other })).data.length, 0);
  assert.equal(
    (
      await call(`/admin/quotes/${r.data.id}/status`, {
        method: "PATCH",
        cookie: admin,
        body: { status: "EN_REVISION" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/admin/quotes", { cookie: admin })).data[0].email,
    "ana@example.test",
  );
});
test("Desactivación oculta productos y logout revoca sesión", async () => {
  assert.equal(
    (await call(`/products/${product.id}`, { method: "DELETE", cookie: admin }))
      .status,
    200,
  );
  assert.equal((await call(`/products/${product.id}`)).status, 404);
  assert.equal(
    (await call("/admin/stats", { cookie: admin })).data.products,
    0,
  );
  await call("/auth/logout", { method: "POST", cookie: client });
  assert.equal((await call("/cart", { cookie: client })).status, 401);
});
