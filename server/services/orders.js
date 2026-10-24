import { createHash } from "node:crypto";
import { paymentAmounts } from "../../shared/payments.js";
import { settings, audit } from "./payments.js";
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
    receipts: await store.all(
      "SELECT id,original_filename,mime_type,file_size,uploaded_at,verification_status,rejection_reason,reviewed_at,reviewed_by FROM payment_receipts WHERE order_id=? ORDER BY uploaded_at,id",
      id,
    ),
    payment_history: await store.all(
      "SELECT a.id,a.action,a.details,a.created_at,a.actor_id,u.first_name,u.last_name FROM payment_audit a JOIN users u ON u.id=a.actor_id WHERE a.order_id=? ORDER BY a.created_at,a.id",
      id,
    ),
  };
}
export async function listOrders(user, admin = false) {
  return await store.all(
    `SELECT o.*,u.first_name,u.last_name,u.email FROM orders o JOIN users u ON u.id=o.user_id ${admin ? "" : "WHERE o.user_id=?"} ORDER BY o.id DESC`,
    ...(admin ? [] : [user.id]),
  );
}
export async function createOrder(user, data) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
  return await store.transaction(async () => {
    const existing = await store.one(
      "SELECT id,checkout_fingerprint FROM orders WHERE user_id=? AND idempotency_key=?",
      user.id,
      data.idempotency_key,
    );
    if (existing) {
      assert(
        existing.checkout_fingerprint === fingerprint,
        409,
        "La clave de confirmación ya se usó con otros datos.",
      );
      return getOrder(existing.id, user);
    }
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

    const config = await settings();
    const amounts = paymentAmounts(
      cart.total,
      data.payment_method === "EFECTIVO" ? config.cash_discount_percentage : 0,
    );
    assert(
      data.expected_subtotal === cart.total &&
        data.expected_total === amounts.total,
      409,
      "Los precios o el descuento cambiaron. Revisá los importes antes de confirmar.",
    );
    if (data.payment_method === "TRANSFERENCIA")
      assert(
        data.bank_alias === config.bank_alias,
        409,
        "El alias de transferencia cambió. Revisá los datos de pago.",
      );
    const id = Number(
      (
        await store.run(
          "INSERT INTO orders(user_id,total,subtotal,payment_method,payment_status,discount_percentage,discount_amount,payment_alias_snapshot,idempotency_key,checkout_fingerprint) VALUES(?,?,?,?,?,?,?,?,?,?)",
          user.id,
          amounts.total,
          amounts.subtotal,
          data.payment_method,
          data.payment_method === "EFECTIVO"
            ? "PENDING_PAYMENT"
            : "PENDING_VERIFICATION",
          amounts.discount_percentage,
          amounts.discount_amount,
          data.payment_method === "TRANSFERENCIA" ? config.bank_alias : null,
          data.idempotency_key,
          fingerprint,
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
    if (data.payment_method === "TRANSFERENCIA") {
      const attached = await store.run(
        "UPDATE payment_receipts SET order_id=? WHERE id=? AND user_id=? AND order_id IS NULL",
        id,
        data.receipt_id,
        user.id,
      );
      assert(
        attached.changes === 1,
        400,
        "Adjuntá un comprobante válido de tu cuenta, sin usar en otro pedido.",
      );
    }
    await audit(id, user.id, "ORDER_CREATED", {
      payment_method: data.payment_method,
      ...amounts,
    });
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
    await audit(id, user.id, "ORDER_STATUS_CHANGED", {
      from: order.status,
      to: status,
    });
    return await getOrder(id, user);
  });
}
