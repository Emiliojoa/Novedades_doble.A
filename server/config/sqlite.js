import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const databasePath =
  process.env.DATABASE_PATH || path.join(serverDir, "data/store.db");
if (databasePath !== ":memory:")
  mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
export const db = new DatabaseSync(databasePath);
db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL, phone TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'CLIENT' CHECK(role IN ('CLIENT','ADMIN')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS users_single_admin ON users(role) WHERE role='ADMIN';
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, parent_id INTEGER REFERENCES categories(id));
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL CHECK(price >= 0),
 stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0), min_stock INTEGER NOT NULL DEFAULT 5 CHECK(min_stock >= 0),
 image TEXT NOT NULL DEFAULT '', category_id INTEGER NOT NULL REFERENCES categories(id), subcategory_id INTEGER REFERENCES categories(id),
 type TEXT NOT NULL DEFAULT 'PRODUCTO' CHECK(type IN ('PRODUCTO','IMPRESION_3D','PERSONALIZADO')),
 active INTEGER NOT NULL DEFAULT 1, featured INTEGER NOT NULL DEFAULT 0,
 wholesale_price INTEGER, wholesale_min_quantity INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cart_items (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity > 0), UNIQUE(user_id,product_id));
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'PENDIENTE', total INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL, subtotal INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS quote_requests (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, description TEXT NOT NULL, quantity INTEGER NOT NULL, reference TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'PENDIENTE', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
PRAGMA user_version = 1;`);

export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
