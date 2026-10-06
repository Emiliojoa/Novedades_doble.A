import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
process.env.DATABASE_PROVIDER = "sqlite";
process.env.DATABASE_PATH = ":memory:";
const { app } = await import("../app.js");
const { store } = await import("../repositories/store.js");
const { closeDatabase } = await import("../config/database.js");
const { hashPassword, createSession } = await import("../services/auth.js");
let server, base, adminCookie, clientCookie, adminId, clientId;
const password = randomBytes(24).toString("hex");
const profile = {
  first_name: "Ana",
  last_name: "García",
  email: "managed@example.test",
  phone: "+54 9 11 1234 5678",
};
async function call(path, method = "GET", body, cookie = adminCookie) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
before(async () => {
  const hash = await hashPassword(password);
  adminId = Number(
    (
      await store.run(
        "INSERT INTO users(first_name,last_name,email,password_hash,role) VALUES(?,?,?,?,'ADMIN')",
        "Admin",
        "Test",
        "admin@example.test",
        hash,
      )
    ).lastInsertRowid,
  );
  clientId = Number(
    (
      await store.run(
        "INSERT INTO users(first_name,last_name,email,password_hash) VALUES(?,?,?,?)",
        "Cliente",
        "Test",
        "client@example.test",
        hash,
      )
    ).lastInsertRowid,
  );
  adminCookie = `session=${await createSession(adminId)}`;
  clientCookie = `session=${await createSession(clientId)}`;
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
});

test("Gestión de usuarios exclusiva del administrador y sin hashes expuestos", async () => {
  for (const [path, method] of [
    ["/admin/users", "GET"],
    ["/admin/users", "POST"],
    [`/admin/users/${clientId}`, "PUT"],
    [`/admin/users/${clientId}/password`, "PATCH"],
    [`/admin/users/${clientId}`, "DELETE"],
  ]) {
    assert.equal((await call(path, method, undefined, "")).status, 401);
    assert.equal(
      (await call(path, method, undefined, clientCookie)).status,
      403,
    );
  }
  const result = await call("/admin/users");
  assert.equal(result.status, 200);
  assert.ok(result.data.every((user) => !("password_hash" in user)));
  assert.equal(
    (
      await call("/admin/users", "POST", {
        ...profile,
        password,
        role: "ADMIN",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(`/admin/users/${clientId}`, "PUT", {
        ...profile,
        role: "ADMIN",
      })
    ).status,
    400,
  );
});

test("Crear, editar, restablecer contraseña y eliminar una cuenta", async () => {
  let result = await call("/admin/users", "POST", { ...profile, password });
  assert.equal(result.status, 201);
  const id = result.data.id;
  assert.equal(result.data.role, "CLIENT");
  assert.equal(result.data.password_hash, undefined);
  assert.equal(
    (await call("/admin/users", "POST", { ...profile, password })).status,
    409,
  );
  assert.equal(
    (
      await call(`/admin/users/${id}`, "PUT", {
        ...profile,
        email: "client@example.test",
      })
    ).status,
    409,
  );
  const updated = {
    ...profile,
    first_name: "Andrea",
    phone: "1155555555",
    email: "updated@example.test",
  };
  result = await call(`/admin/users/${id}`, "PUT", updated);
  assert.equal(result.status, 200);
  assert.equal(result.data.first_name, "Andrea");
  assert.equal(result.data.phone, updated.phone);
  assert.equal(result.data.password_hash, undefined);
  const login = await call(
    "/auth/login",
    "POST",
    { email: updated.email, password },
    "",
  );
  assert.equal(login.status, 200);
  assert.equal(
    (await call(`/admin/users/${id}/password`, "PATCH", { password: "short" }))
      .status,
    400,
  );
  const newPassword = randomBytes(24).toString("hex");
  assert.equal(
    (
      await call(`/admin/users/${id}/password`, "PATCH", {
        password: newPassword,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/auth/me", "GET", undefined, login.cookie)).status,
    401,
  );
  assert.equal(
    (await call("/auth/login", "POST", { email: updated.email, password }, ""))
      .status,
    401,
  );
  const newLogin = await call(
    "/auth/login",
    "POST",
    { email: updated.email, password: newPassword },
    "",
  );
  assert.equal(newLogin.status, 200);
  assert.equal((await call(`/admin/users/${id}`, "DELETE")).status, 200);
  assert.equal(
    (await call("/auth/me", "GET", undefined, newLogin.cookie)).status,
    401,
  );
  assert.equal((await call(`/admin/users/${id}`, "DELETE")).status, 404);
  assert.equal((await call(`/admin/users/${id}`, "PUT", updated)).status, 404);
});

test("Protege al administrador y conserva cuentas con pedidos o solicitudes", async () => {
  assert.equal((await call(`/admin/users/${adminId}`, "DELETE")).status, 409);
  await store.run("INSERT INTO orders(user_id,total) VALUES(?,?)", clientId, 0);
  assert.equal((await call(`/admin/users/${clientId}`, "DELETE")).status, 409);
  const created = await call("/admin/users", "POST", {
    ...profile,
    email: "quotes@example.test",
    password,
  });
  await store.run(
    "INSERT INTO quote_requests(user_id,name,description,quantity) VALUES(?,?,?,?)",
    created.data.id,
    "Idea",
    "Una idea de prueba.",
    1,
  );
  assert.equal(
    (await call(`/admin/users/${created.data.id}`, "DELETE")).status,
    409,
  );
  assert.equal(
    (await call("/auth/me", "GET", undefined, clientCookie)).status,
    200,
  );
});
