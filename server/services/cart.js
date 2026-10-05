import { store } from "../repositories/store.js";
import { getProduct } from "./catalog.js";
import { assert } from "../utils/errors.js";
export async function getCart(userId) {
  const items = await store.all(
    "SELECT c.id,c.product_id,c.quantity,p.name,p.price,p.image,p.stock,p.active,p.type FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.user_id=?",
    userId,
  );
  return {
    items,
    total: items.reduce((s, p) => s + p.price * p.quantity, 0),
  };
}
async function check(productId, quantity) {
  assert(
    Number.isInteger(quantity) && quantity > 0 && quantity <= 10000,
    400,
    "La cantidad debe estar entre 1 y 10000.",
  );
  const p = await getProduct(productId);
  assert(
    p.type !== "PERSONALIZADO",
    400,
    "Los diseños personalizados requieren una solicitud de presupuesto.",
  );
  assert(
    quantity <= p.stock,
    409,
    `Stock insuficiente para ${p.name}. Disponible: ${p.stock}.`,
  );
}
export async function addItem(userId, data) {
  return store.transaction(async () => {
    const existing = await store.one(
      "SELECT * FROM cart_items WHERE user_id=? AND product_id=?",
      userId,
      data.product_id,
    );
    const quantity = (existing?.quantity || 0) + data.quantity;
    await check(data.product_id, quantity);
    await store.run(
      "INSERT INTO cart_items(user_id,product_id,quantity) VALUES(?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=excluded.quantity",
      userId,
      data.product_id,
      quantity,
    );
    return await getCart(userId);
  });
}
export async function updateItem(userId, id, quantity) {
  return store.transaction(async () => {
    const item = await store.one(
      "SELECT * FROM cart_items WHERE id=? AND user_id=?",
      id,
      userId,
    );
    assert(item, 404, "Producto del carrito no encontrado.");
    await check(item.product_id, quantity);
    await store.run(
      "UPDATE cart_items SET quantity=? WHERE id=? AND user_id=?",
      quantity,
      id,
      userId,
    );
    return await getCart(userId);
  });
}
export async function removeItem(userId, id) {
  return store.transaction(async () => {
    await store.run(
      "DELETE FROM cart_items WHERE id=? AND user_id=?",
      id,
      userId,
    );
    return await getCart(userId);
  });
}
export async function clearCart(userId) {
  return store.transaction(async () => {
    await store.run("DELETE FROM cart_items WHERE user_id=?", userId);
    return await getCart(userId);
  });
}
