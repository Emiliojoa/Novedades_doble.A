import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { store } from "../repositories/store.js";
import { closeDatabase, provider, rawSql } from "../config/database.js";
import * as auth from "../services/auth.js";
import * as catalog from "../services/catalog.js";
import * as cart from "../services/cart.js";
import * as orders from "../services/orders.js";
import * as quotes from "../services/quotes.js";
import { stats } from "../services/admin.js";
const rollback = Symbol("rollback-test-data");
try {
  assert.equal(provider, "postgres");
  const before = await stats();
  const privacy = await rawSql(
    "SELECT has_schema_privilege('anon','store','USAGE') anon_access,has_schema_privilege('authenticated','store','USAGE') client_access",
  );
  assert.equal(privacy.rows[0].anon_access, false);
  assert.equal(privacy.rows[0].client_access, false);
  try {
    await store.transaction(async () => {
      const tag = randomBytes(8).toString("hex");
      const user = await auth.register({
        first_name: "Prueba temporal",
        last_name: tag,
        email: `${tag}@example.test`,
        phone: "",
        password: randomBytes(24).toString("hex"),
      });
      const admin = { ...user, role: "ADMIN" };
      const category = await catalog.saveCategory({
        name: `Prueba ${tag}`,
        parent_id: null,
      });
      const sub = await catalog.saveCategory({
        name: `Sub ${tag}`,
        parent_id: category.id,
      });
      await catalog.saveCategory(
        { name: `Sub editada ${tag}`, parent_id: category.id },
        sub.id,
      );
      const data = {
        name: `Producto ${tag}`,
        description: "Transacción de verificación: se revierte al terminar.",
        price: 1000000,
        stock: 5,
        min_stock: 2,
        image: "",
        category_id: category.id,
        subcategory_id: sub.id,
        type: "PRODUCTO",
        active: true,
        featured: false,
      };
      const product = await catalog.saveProduct(data);
      assert.equal((await catalog.listProducts({ search: tag })).length, 1);
      const token = await auth.createSession(user.id);
      assert.equal((await auth.sessionUser(token)).id, user.id);
      await auth.logout(token);
      assert.equal(await auth.sessionUser(token), null);
      await cart.addItem(user.id, { product_id: product.id, quantity: 2 });
      const order = await orders.createOrder(user);
      assert.equal(order.user_id, user.id);
      assert.equal(order.total, 2000000);
      assert.equal((await catalog.getProduct(product.id)).stock, 3);
      await catalog.saveProduct(
        { ...data, price: 1200000, stock: 3 },
        product.id,
      );
      assert.equal(
        (await orders.getOrder(order.id, user)).items[0].unit_price,
        1000000,
      );
      await orders.changeStatus(order.id, "CANCELADO", admin);
      await orders.changeStatus(order.id, "CANCELADO", admin);
      assert.equal((await catalog.getProduct(product.id)).stock, 5);
      await quotes.createQuote(user.id, {
        name: "Prueba temporal",
        description: "Solicitud de prueba que se revierte.",
        quantity: 1,
        reference: "",
      });
      assert.equal((await quotes.listQuotes(user.id)).length, 1);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  const after = await stats();
  assert.equal(before.orders, after.orders);
  assert.equal(before.clients, after.clients);
  assert.equal(before.products, after.products);
  console.log(
    "Supabase verificado: esquema privado, sesiones, catálogo, carrito, pedido, precio histórico, cancelación y presupuestos. Toda la transacción de prueba fue revertida.",
  );
} catch (error) {
  console.error(
    "Falló la verificación PostgreSQL:",
    error.code || error.message,
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
