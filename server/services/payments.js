import { randomUUID } from "node:crypto";
import { store } from "../repositories/store.js";
import { assert } from "../utils/errors.js";
import { getOrder } from "./orders.js";
import { receiptMaxBytes } from "./receipts.js";

export const settings = async () => ({
  ...(await store.one(
    "SELECT bank_alias,cash_discount_percentage,updated_at FROM payment_settings WHERE id=1",
  )),
  receipt_max_bytes: receiptMaxBytes,
});
export async function audit(orderId, actorId, action, details = {}) {
  await store.run(
    "INSERT INTO payment_audit(id,order_id,actor_id,action,details) VALUES(?,?,?,?,?)",
    randomUUID(),
    orderId,
    actorId,
    action,
    JSON.stringify(details),
  );
}
export async function updateSettings(data, user) {
  assert(user?.role === "ADMIN", 403, "Acceso exclusivo de administración.");
  return store.transaction(async () => {
    await store.run(
      "UPDATE payment_settings SET bank_alias=?,cash_discount_percentage=?,updated_at=CURRENT_TIMESTAMP WHERE id=1",
      data.bank_alias,
      data.cash_discount_percentage,
    );
    await audit(null, user.id, "SETTINGS_UPDATED", data);
    return settings();
  });
}
export async function attachReceipt(orderId, receiptId, user) {
  return store.transaction(async () => {
    const order = await getOrder(orderId, user);
    assert(
      order.user_id === user.id &&
        order.payment_method === "TRANSFERENCIA" &&
        order.payment_status === "REJECTED" &&
        order.status !== "CANCELADO",
      409,
      "Solo podés reenviar un comprobante de un pago rechazado y no cancelado.",
    );
    const updated = await store.run(
      "UPDATE payment_receipts SET order_id=? WHERE id=? AND user_id=? AND order_id IS NULL",
      orderId,
      receiptId,
      user.id,
    );
    assert(
      updated.changes === 1,
      400,
      "Seleccioná un nuevo comprobante válido de tu cuenta.",
    );
    await store.run(
      "UPDATE orders SET payment_status='PENDING_VERIFICATION' WHERE id=?",
      orderId,
    );
    await audit(orderId, user.id, "RECEIPT_RESUBMITTED", {
      receipt_id: receiptId,
    });
    return getOrder(orderId, user);
  });
}
export async function reviewPayment(id, data, user) {
  assert(user.role === "ADMIN", 403, "Acceso exclusivo de administración.");
  return store.transaction(async () => {
    const order = await getOrder(id, user);
    assert(
      order.status !== "CANCELADO",
      409,
      "No se puede aprobar ni rechazar un pedido cancelado.",
    );
    assert(
      order.payment_status === data.expected_status,
      409,
      "El pago cambió. Actualizá el pedido antes de revisarlo.",
    );
    assert(
      ["PENDING_PAYMENT", "PENDING_VERIFICATION"].includes(
        order.payment_status,
      ),
      409,
      "Este pago ya fue revisado o no tiene un método registrado.",
    );
    if (order.payment_method === "TRANSFERENCIA") {
      assert(
        order.payment_status === "PENDING_VERIFICATION" && data.receipt_id,
        400,
        "Seleccioná el comprobante que estás revisando.",
      );
      const receipt = order.receipts.find(
        (r) =>
          r.id === data.receipt_id &&
          r.verification_status === "PENDING_VERIFICATION",
      );
      assert(receipt, 409, "El comprobante cambió. Actualizá el pedido.");
      await store.run(
        "UPDATE payment_receipts SET verification_status=?,rejection_reason=?,reviewed_at=?,reviewed_by=? WHERE id=?",
        data.status,
        data.status === "REJECTED" ? data.reason : null,
        new Date().toISOString(),
        user.id,
        receipt.id,
      );
    } else
      assert(
        data.status === "APPROVED",
        400,
        "En efectivo solo se confirma el pago recibido.",
      );
    const approved = data.status === "APPROVED";
    await store.run(
      "UPDATE orders SET payment_status=?,payment_approved_at=?,payment_approved_by=? WHERE id=?",
      data.status,
      approved ? new Date().toISOString() : null,
      approved ? user.id : null,
      id,
    );
    await audit(
      id,
      user.id,
      approved ? "PAYMENT_APPROVED" : "PAYMENT_REJECTED",
      { receipt_id: data.receipt_id, reason: data.reason },
    );
    return getOrder(id, user);
  });
}
export async function adminPayments(query) {
  const clauses = [],
    args = [];
  if (query.payment_method) {
    clauses.push("o.payment_method=?");
    args.push(query.payment_method);
  }
  if (query.payment_status) {
    clauses.push("o.payment_status=?");
    args.push(query.payment_status);
  }
  if (query.status) {
    clauses.push("o.status=?");
    args.push(query.status);
  }
  if (query.search) {
    clauses.push(
      "(CAST(o.id AS TEXT) LIKE ? OR LOWER(u.first_name || ' ' || u.last_name) LIKE ? OR LOWER(u.email) LIKE ?)",
    );
    const search = `%${query.search.toLowerCase()}%`;
    args.push(search, search, search);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const from = " FROM orders o JOIN users u ON u.id=o.user_id";
  const total = (
    await store.one(`SELECT COUNT(*) count${from}${where}`, ...args)
  ).count;
  const orders = await store.all(
    `SELECT o.*,u.first_name,u.last_name,u.email${from}${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    ...args,
    query.limit,
    (query.page - 1) * query.limit,
  );
  const counters = await store.one(
    "SELECT COALESCE(SUM(CASE WHEN payment_status='PENDING_PAYMENT' THEN 1 ELSE 0 END),0) pending_payment, COALESCE(SUM(CASE WHEN payment_status='PENDING_VERIFICATION' THEN 1 ELSE 0 END),0) pending_verification FROM orders WHERE status<>'CANCELADO'",
  );
  return { orders, total, page: query.page, limit: query.limit, counters };
}
