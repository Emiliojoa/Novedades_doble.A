import test from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_PROVIDER = "sqlite";
process.env.DATABASE_PATH = ":memory:";
const { sameOrigin } = await import("../middleware/security.js");
const { closeDatabase } = await import("../config/database.js");
test("Vite puede cambiar de puerto sin ampliar los orígenes de producción", () => {
  const previous = {
    mode: process.env.NODE_ENV,
    origin: process.env.APP_ORIGIN,
  };
  function check(origin, site = "same-origin") {
    let passed = false;
    sameOrigin(
      {
        method: "POST",
        get: (key) => ({ origin: origin, "sec-fetch-site": site })[key],
      },
      {},
      () => {
        passed = true;
      },
    );
    assert.equal(passed, true);
  }
  try {
    process.env.NODE_ENV = "development";
    process.env.APP_ORIGIN = "http://localhost:5173";
    for (const origin of [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "http://[::1]:5174",
    ])
      check(origin);
    for (const origin of [
      "http://localhost.evil.test:5174",
      "https://evil.test",
      "http://localhost:6000",
      "null",
    ])
      assert.throws(() => check(origin), { status: 403 });
    assert.throws(() => check("http://localhost:5174", "cross-site"), {
      status: 403,
    });
    process.env.NODE_ENV = "production";
    process.env.APP_ORIGIN = "https://shop.example.test";
    check("https://shop.example.test");
    assert.throws(() => check("http://localhost:5174"), { status: 403 });
  } finally {
    for (const [key, value] of [
      ["NODE_ENV", previous.mode],
      ["APP_ORIGIN", previous.origin],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test.after(closeDatabase);
