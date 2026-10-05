import { store, productsQuery, productDTO } from "../repositories/store.js";
import { assert } from "../utils/errors.js";
export const categories = async () =>
  await store.all("SELECT * FROM categories ORDER BY name");
export async function listProducts(query = {}, admin = false) {
  const clauses = admin ? [] : ["p.active=1"];
  const values = [];
  if (query.search) {
    clauses.push("LOWER(p.name) LIKE LOWER(?)");
    values.push(`%${String(query.search).slice(0, 120)}%`);
  }
  for (const key of ["category_id", "subcategory_id"])
    if (query[key]) {
      clauses.push(`p.${key}=?`);
      values.push(Number(query[key]) || 0);
    }
  if (query.type) {
    clauses.push("p.type=?");
    values.push(String(query.type));
  }
  if (query.featured === "true") clauses.push("p.featured=1");
  if (query.available === "true") clauses.push("p.stock>0");
  const sort =
    {
      price_asc: "p.price ASC",
      price_desc: "p.price DESC",
      name: "p.name ASC",
      recent: "p.id DESC",
    }[query.sort] || "p.id DESC";
  return (
    await store.all(
      `${productsQuery}${clauses.length ? " WHERE " + clauses.join(" AND ") : ""} ORDER BY ${sort}`,
      ...values,
    )
  ).map(productDTO);
}
export async function getProduct(id, admin = false) {
  const p = productDTO(await store.one(`${productsQuery} WHERE p.id=?`, id));
  assert(p && (admin || p.active), 404, "Producto no encontrado.");
  return p;
}
async function checkCategory(data) {
  const category = await store.one(
    "SELECT * FROM categories WHERE id=?",
    data.category_id,
  );
  assert(
    category && !category.parent_id,
    400,
    "Seleccioná una categoría principal.",
  );
  if (data.subcategory_id)
    assert(
      await store.one(
        "SELECT id FROM categories WHERE id=? AND parent_id=?",
        data.subcategory_id,
        data.category_id,
      ),
      400,
      "La subcategoría no pertenece a esta categoría.",
    );
}
export async function saveProduct(data, id) {
  return store.transaction(async () => {
    await checkCategory(data);
    const values = [
      data.name,
      data.description,
      data.price,
      data.stock,
      data.min_stock,
      data.image,
      data.category_id,
      data.subcategory_id,
      data.type,
      Number(data.active),
      Number(data.featured),
    ];
    if (id) {
      await getProduct(id, true);
      await store.run(
        "UPDATE products SET name=?,description=?,price=?,stock=?,min_stock=?,image=?,category_id=?,subcategory_id=?,type=?,active=?,featured=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ...values,
        id,
      );
    } else
      id = Number(
        (
          await store.run(
            "INSERT INTO products(name,description,price,stock,min_stock,image,category_id,subcategory_id,type,active,featured) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            ...values,
          )
        ).lastInsertRowid,
      );
    return await getProduct(id, true);
  });
}
export async function deactivateProduct(id) {
  return store.transaction(async () => {
    await getProduct(id, true);
    await store.run(
      "UPDATE products SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      id,
    );
  });
}
export async function saveCategory(data, id) {
  return store.transaction(async () => {
    if (id)
      assert(
        await store.one("SELECT id FROM categories WHERE id=?", id),
        404,
        "Categoría no encontrada.",
      );
    if (data.parent_id) {
      assert(
        data.parent_id !== id &&
          (await store.one(
            "SELECT id FROM categories WHERE id=? AND parent_id IS NULL",
            data.parent_id,
          )),
        400,
        "La categoría padre debe ser una categoría principal.",
      );
      if (id)
        assert(
          !(await store.one(
            "SELECT id FROM categories WHERE parent_id=? UNION SELECT id FROM products WHERE category_id=?",
            id,
            id,
          )),
          409,
          "Esta categoría ya tiene productos o subcategorías y debe seguir siendo principal.",
        );
    }
    if (id)
      assert(
        !(await store.one(
          "SELECT id FROM products WHERE subcategory_id=? AND category_id IS NOT ?",
          id,
          data.parent_id,
        )),
        409,
        "No se puede mover una subcategoría con productos asociados.",
      );
    try {
      if (id)
        await store.run(
          "UPDATE categories SET name=?,parent_id=? WHERE id=?",
          data.name,
          data.parent_id,
          id,
        );
      else
        id = Number(
          (
            await store.run(
              "INSERT INTO categories(name,parent_id) VALUES(?,?)",
              data.name,
              data.parent_id,
            )
          ).lastInsertRowid,
        );
    } catch (e) {
      if (e.code === "23505" || e.message.includes("UNIQUE"))
        assert(false, 409, "Ya existe una categoría con ese nombre.");
      throw e;
    }
    return await store.one("SELECT * FROM categories WHERE id=?", id);
  });
}
export async function deleteCategory(id) {
  return store.transaction(async () => {
    assert(
      await store.one("SELECT id FROM categories WHERE id=?", id),
      404,
      "Categoría no encontrada.",
    );
    assert(
      !(await store.one(
        "SELECT id FROM products WHERE category_id=? OR subcategory_id=? UNION SELECT id FROM categories WHERE parent_id=?",
        id,
        id,
        id,
      )),
      409,
      "La categoría tiene productos o subcategorías asociados.",
    );
    await store.run("DELETE FROM categories WHERE id=?", id);
  });
}
