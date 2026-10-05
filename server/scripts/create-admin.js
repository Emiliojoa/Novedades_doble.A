import { store } from "../repositories/store.js";
import { hashPassword } from "../services/auth.js";
import { registerSchema } from "../models/schemas.js";
import { closeDatabase } from "../config/database.js";
try {
  const data = registerSchema.parse({
    first_name: process.env.ADMIN_FIRST_NAME,
    last_name: process.env.ADMIN_LAST_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  if (await store.one("SELECT id FROM users WHERE email=?", data.email))
    throw new Error("El email ya existe. No se modificó su rol ni contraseña.");
  const hash = await hashPassword(data.password);
  await store.run(
    "INSERT INTO users(first_name,last_name,email,password_hash,role) VALUES(?,?,?,?,'ADMIN')",
    data.first_name,
    data.last_name,
    data.email,
    hash,
  );
  console.log(
    "Administrador creado. Ya podés iniciar sesión. Quitá ADMIN_PASSWORD de tu .env cuando termines.",
  );
} catch (error) {
  console.error(
    error.issues
      ? "Completá ADMIN_EMAIL, ADMIN_FIRST_NAME, ADMIN_LAST_NAME y ADMIN_PASSWORD (mínimo 12 caracteres) en server/.env."
      : error.message,
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
