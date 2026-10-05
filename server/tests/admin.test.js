import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
process.env.DATABASE_PROVIDER = "sqlite";
process.env.DATABASE_PATH = ":memory:";
const { createFirstAdmin } = await import("../services/bootstrap-admin.js");
const { store } = await import("../repositories/store.js");
const { closeDatabase } = await import("../config/database.js");
after(closeDatabase);
test("Solo un ADMIN incluso con dos comandos simultáneos y SQL directo", async () => {
  const input = {
    first_name: "Admin",
    last_name: "Test",
    email: "first@example.test",
    password: randomBytes(24).toString("hex"),
  };
  const results = await Promise.allSettled([
    createFirstAdmin(input),
    createFirstAdmin({ ...input, email: "second@example.test" }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.filter((r) => r.status === "rejected" && r.reason.status === 409)
      .length,
    1,
  );
  const original = await store.one("SELECT * FROM users WHERE role='ADMIN'");
  await assert.rejects(createFirstAdmin({ ...input, email: original.email }), {
    status: 409,
  });
  assert.equal(
    (await store.one("SELECT * FROM users WHERE role='ADMIN'")).password_hash,
    original.password_hash,
  );
  await assert.rejects(
    store.run(
      "INSERT INTO users(first_name,last_name,email,password_hash,role) VALUES(?,?,?,?,'ADMIN')",
      "Otro",
      "Admin",
      "third@example.test",
      "unused",
    ),
  );
  assert.equal(
    (await store.one("SELECT COUNT(*) count FROM users WHERE role='ADMIN'"))
      .count,
    1,
  );
});
