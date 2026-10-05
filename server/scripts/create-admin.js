import { createFirstAdmin } from "../services/bootstrap-admin.js";
import { closeDatabase } from "../config/database.js";
try {
  await createFirstAdmin({
    first_name: process.env.ADMIN_FIRST_NAME,
    last_name: process.env.ADMIN_LAST_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
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
