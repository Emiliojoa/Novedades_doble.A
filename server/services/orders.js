import { store } from "../repositories/store.js";
import { getCart, clearCart } from "./cart.js";
import { assert } from "../utils/errors.js";
export async function getOrder(id, user) {
  const order = await store.one(
    "SELECT o.*,u.first_name,u.last_name,u.email,u.phone FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?",
    id,
  );
  assert(
    order && (user.role === "ADMIN" || order.user_id === user.id),
    404,
    "Pedido no encontrado.",
  );
  return {
    ...order,
    items: await store.all("SELECT * FROM order_items WHERE order_id=?", id),
  };
}
export async function listOrders(user, admin = false) {
  return await store.all(
    `SELECT o.*,u.first_name,u.last_name,u.email FROM orders o JOIN users u ON u.id=o.user_id ${admin ? "" : "WHERE o.user_id=?"} ORDER BY o.id DESC`,
    ...(admin ? [] : [user.id]),
  );
}
export async function createOrder(user) {
  return await store.transaction(async () => {
    const cart = await getCart(user.id);
    assert(cart.items.length, 400, "Tu carrito está vacío.");
    assert(
      Number.isSafeInteger(cart.total),
      400,
      "El total del pedido supera el límite permitido.",
    );
    for (const p of cart.items)
      assert(
        p.active && p.type !== "PERSONALIZADO" && p.quantity <= p.stock,
        409,
        `Revisá la disponibilidad de ${p.name}.`,
      );
    const id = Number(
      (
        await store.run(
          "INSERT INTO orders(user_id,total) VALUES(?,?)",
          user.id,
          cart.total,
        )
      ).lastInsertRowid,
    );
    for (const p of cart.items) {
      await store.run(
        "INSERT INTO order_items(order_id,product_id,name,quantity,unit_price,subtotal) VALUES(?,?,?,?,?,?)",
        id,
        p.product_id,
        p.name,
        p.quantity,
        p.price,
        p.price * p.quantity,
      );
      const updated = await store.run(
        "UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock>=? AND active=1",
        p.quantity,
        p.product_id,
        p.quantity,
      );
      assert(
        updated.changes === 1,
        409,
        `Cambió la disponibilidad de ${p.name}. Revisá tu carrito.`,
      );
    }
    await clearCart(user.id);
    return await getOrder(id, user);
  });
}
export const transitions = {
  PENDIENTE: ["CONFIRMADO", "CANCELADO"],
  CONFIRMADO: ["EN_PREPARACION", "CANCELADO"],
  EN_PREPARACION: ["LISTO", "CANCELADO"],
  LISTO: ["ENTREGADO", "CANCELADO"],
  ENTREGADO: [],
  CANCELADO: [],
};
export async function changeStatus(id, status, user) {
  return await store.transaction(async () => {
    const order = await getOrder(id, user);
    if (order.status === status) return order;
    assert(
      transitions[order.status].includes(status),
      409,
      "Ese cambio de estado no está permitido.",
    );
    if (status === "CANCELADO")
      for (const item of order.items)
        await store.run(
          "UPDATE products SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          item.quantity,
          item.product_id,
        );
    await store.run("UPDATE orders SET status=? WHERE id=?", status, id);
    return await getOrder(id, user);
  });
}
