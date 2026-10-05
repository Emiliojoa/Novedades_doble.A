import { store } from "../repositories/store.js";
import { hashPassword } from "./auth.js";
import { registerSchema } from "../models/schemas.js";
import { assert } from "../utils/errors.js";

// CLI only. There is deliberately no public route for this operation.
export async function createFirstAdmin(input) {
  const data = registerSchema.parse(input);
  const hash = await hashPassword(data.password);
  return store.transaction(async () => {
    assert(
      !(await store.one("SELECT id FROM users WHERE role='ADMIN'")),
      409,
      "Ya existe un administrador. No se creó otro ni se modificó su contraseña. Ingresá con esa cuenta.",
    );
    assert(
      !(await store.one("SELECT id FROM users WHERE email=?", data.email)),
      409,
      "El email ya pertenece a otra cuenta. No se modificó su rol ni contraseña.",
    );
    await store.run(
      "INSERT INTO users(first_name,last_name,email,password_hash,role) VALUES(?,?,?,?,'ADMIN')",
      data.first_name,
      data.last_name,
      data.email,
      hash,
    );
  });
}
