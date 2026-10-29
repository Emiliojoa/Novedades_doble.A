import test, { after } from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_PROVIDER = "sqlite";
process.env.DATABASE_PATH = ":memory:";
delete process.env.SUPABASE_URL;
const { store } = await import("../repositories/store.js");
const { saveProduct, getProduct } = await import("../services/catalog.js");
const { productSchema } = await import("../models/schemas.js");
const { closeDatabase } = await import("../config/database.js");
after(closeDatabase);
test("Product gallery preserves legacy photos, order, cover selection and removals", async () => {
  const category = await store.run(
    "INSERT INTO categories(name) VALUES(?)",
    "Gallery",
  );
  const legacy = productSchema.parse({
    name: "Gallery",
    price: 100,
    stock: 2,
    min_stock: 1,
    image: "https://example.test/old.jpg",
    category_id: Number(category.lastInsertRowid),
    type: "PRODUCTO",
    active: true,
  });
  const product = await saveProduct(legacy);
  assert.deepEqual(product.images, [legacy.image]);
  const images = ["https://example.test/second.jpg", legacy.image];
  const updated = await saveProduct(
    productSchema.parse({ ...legacy, images }),
    product.id,
  );
  assert.equal(updated.image, images[0]);
  assert.deepEqual((await getProduct(product.id)).images, images);
  await saveProduct(legacy, product.id);
  assert.deepEqual((await getProduct(product.id)).images, [legacy.image]);
  await saveProduct(productSchema.parse({ ...legacy, images: [] }), product.id);
  assert.equal((await getProduct(product.id)).image, "");
  assert.deepEqual((await getProduct(product.id)).images, []);
  assert.equal(
    productSchema.safeParse({ ...legacy, images: ["javascript:alert(1)"] })
      .success,
    false,
  );
  assert.equal(
    productSchema.safeParse({ ...legacy, images: Array(9).fill(legacy.image) })
      .success,
    false,
  );
});
