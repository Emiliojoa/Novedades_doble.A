import { query, transaction } from "../config/database.js";

// SQL is confined to this adapter. Services own business rules.
export const store = {
  one: (sql, ...args) => query(sql, args, "one"),
  all: (sql, ...args) => query(sql, args, "all"),
  run: (sql, ...args) => query(sql, args, "run"),
  transaction,
};
export const productsQuery = `SELECT p.*, c.name category_name, s.name subcategory_name FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN categories s ON s.id=p.subcategory_id`;
export function productDTO(p) {
  return (
    p && { ...p, active: Boolean(p.active), featured: Boolean(p.featured) }
  );
}
export function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...user } = u;
  return user;
}
