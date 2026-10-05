process.env.DATABASE_PROVIDER = "sqlite";
process.env.DATABASE_PATH = ":memory:";
process.env.APP_ORIGIN = "http://127.0.0.1:3011";
delete process.env.SUPABASE_URL;
const { store } = await import("../repositories/store.js");
const { hashPassword } = await import("../services/auth.js");
if (!process.env.E2E_ADMIN_PASSWORD)
  throw new Error("Playwright debe proporcionar una contraseña temporal.");
await store.run(
  "INSERT INTO users(first_name,last_name,email,password_hash,role) VALUES(?,?,?,?,'ADMIN')",
  "Admin",
  "Pruebas",
  "admin@example.test",
  await hashPassword(process.env.E2E_ADMIN_PASSWORD),
);
const { app } = await import("../app.js");
app.listen(3011, "127.0.0.1", () => console.log("Servidor E2E aislado listo."));
