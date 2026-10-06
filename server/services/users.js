import { store, publicUser } from "../repositories/store.js";
import { hashPassword, register } from "./auth.js";
import { assert } from "../utils/errors.js";

export const listUsers = () =>
  store.all(
    "SELECT id,first_name,last_name,email,phone,role,created_at FROM users ORDER BY id DESC",
  );
export const createUser = (data) => register(data);

async function getUser(id) {
  const user = await store.one("SELECT * FROM users WHERE id=?", id);
  assert(user, 404, "Usuario no encontrado.");
  return user;
}

export async function updateUser(id, data) {
  try {
    return await store.transaction(async () => {
      await getUser(id);
      await store.run(
        "UPDATE users SET first_name=?,last_name=?,email=?,phone=? WHERE id=?",
        data.first_name,
        data.last_name,
        data.email,
        data.phone,
        id,
      );
      return publicUser(await getUser(id));
    });
  } catch (error) {
    if (error.code === "23505" || error.message.includes("UNIQUE"))
      assert(false, 409, "Ya existe una cuenta con este email.");
    throw error;
  }
}

export async function changePassword(id, password) {
  await getUser(id);
  const hash = await hashPassword(password);
  await store.transaction(async () => {
    await getUser(id);
    await store.run("UPDATE users SET password_hash=? WHERE id=?", hash, id);
    await store.run("DELETE FROM sessions WHERE user_id=?", id);
  });
}

export async function deleteUser(id) {
  try {
    await store.transaction(async () => {
      const user = await getUser(id);
      assert(
        user.role !== "ADMIN",
        409,
        "La cuenta administradora no se puede eliminar.",
      );
      const orders = await store.one(
        "SELECT COUNT(*) count FROM orders WHERE user_id=?",
        id,
      );
      const quotes = await store.one(
        "SELECT COUNT(*) count FROM quote_requests WHERE user_id=?",
        id,
      );
      assert(
        !orders.count && !quotes.count,
        409,
        "Este usuario tiene pedidos o solicitudes. Conservá su cuenta para mantener el historial.",
      );
      await store.run("DELETE FROM cart_items WHERE user_id=?", id);
      await store.run("DELETE FROM sessions WHERE user_id=?", id);
      await store.run("DELETE FROM users WHERE id=?", id);
    });
  } catch (error) {
    if (error.code === "23503" || error.message.includes("FOREIGN KEY"))
      assert(
        false,
        409,
        "Este usuario tiene actividad asociada y no se puede eliminar.",
      );
    throw error;
  }
}
