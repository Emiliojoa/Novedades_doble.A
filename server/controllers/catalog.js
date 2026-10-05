import * as catalog from "../services/catalog.js";
export const list = async (req, res) =>
  res.json(await catalog.listProducts(req.query));
export const detail = async (req, res) =>
  res.json(await catalog.getProduct(Number(req.params.id)));
export const save = async (req, res) =>
  res
    .status(req.params.id ? 200 : 201)
    .json(
      await catalog.saveProduct(
        req.data,
        req.params.id ? Number(req.params.id) : undefined,
      ),
    );
export const remove = async (req, res) => {
  await catalog.deactivateProduct(Number(req.params.id));
  res.json({
    ok: true,
  });
};
export const categories = async (req, res) =>
  res.json(await catalog.categories());
export const saveCategory = async (req, res) =>
  res
    .status(req.params.id ? 200 : 201)
    .json(
      await catalog.saveCategory(
        req.data,
        req.params.id ? Number(req.params.id) : undefined,
      ),
    );
export const removeCategory = async (req, res) => {
  await catalog.deleteCategory(Number(req.params.id));
  res.json({
    ok: true,
  });
};
