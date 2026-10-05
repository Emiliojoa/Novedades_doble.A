import { store } from "../repositories/store.js";
import { listOrders } from "./orders.js";
export async function stats() {
  return {
    products: (
      await store.one("SELECT COUNT(*) count FROM products WHERE active=1")
    ).count,
    low_stock: (
      await store.one(
        "SELECT COUNT(*) count FROM products WHERE stock<=min_stock AND active=1",
      )
    ).count,
    pending: (
      await store.one(
        "SELECT COUNT(*) count FROM orders WHERE status='PENDIENTE'",
      )
    ).count,
    orders: (await store.one("SELECT COUNT(*) count FROM orders")).count,
    clients: (
      await store.one("SELECT COUNT(*) count FROM users WHERE role='CLIENT'")
    ).count,
    sales: (
      await store.one(
        "SELECT COALESCE(SUM(total),0) total FROM orders WHERE status='ENTREGADO'",
      )
    ).total,
    recent: (await listOrders(null, true)).slice(0, 8),
  };
}
export const customers = async () =>
  await store.all(
    "SELECT id,first_name,last_name,email,phone,created_at FROM users WHERE role='CLIENT' ORDER BY id DESC",
  );
