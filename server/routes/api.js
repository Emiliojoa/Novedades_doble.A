import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as auth from "../controllers/auth.js";
import * as catalog from "../controllers/catalog.js";
import * as commerce from "../controllers/commerce.js";
import * as schemas from "../models/schemas.js";
import { authenticate, adminOnly, validate } from "../middleware/security.js";
import { listProducts } from "../services/catalog.js";
import { stats, customers } from "../services/admin.js";
import { listOrders, changeStatus } from "../services/orders.js";
import { listQuotes, updateQuote } from "../services/quotes.js";
import { assert } from "../utils/errors.js";
import { saveImage } from "../services/images.js";
export const uploadsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../uploads",
);
mkdirSync(uploadsDir, {
  recursive: true,
});
export const api = Router();
api.param("id", (req, res, next, id) => {
  assert(
    /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0,
    400,
    "Identificador inválido.",
  );
  next();
});
const admin = [authenticate, adminOnly];
const accessLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Intentá nuevamente en 15 minutos.",
  },
});
api.post(
  "/auth/register",
  accessLimit,
  validate(schemas.registerSchema),
  auth.register,
);
api.post("/auth/login", accessLimit, validate(schemas.loginSchema), auth.login);
api.post("/auth/logout", auth.logout);
api.get("/auth/me", authenticate, auth.me);
api.get("/products", catalog.list);
api.get("/products/:id", catalog.detail);
api.post("/products", ...admin, validate(schemas.productSchema), catalog.save);
api.put(
  "/products/:id",
  ...admin,
  validate(schemas.productSchema),
  catalog.save,
);
api.delete("/products/:id", ...admin, catalog.remove);
api.get("/categories", catalog.categories);
api.post(
  "/categories",
  ...admin,
  validate(schemas.categorySchema),
  catalog.saveCategory,
);
api.put(
  "/categories/:id",
  ...admin,
  validate(schemas.categorySchema),
  catalog.saveCategory,
);
api.delete("/categories/:id", ...admin, catalog.removeCategory);
api.get("/cart", authenticate, commerce.getCart);
api.delete("/cart", authenticate, commerce.clearCart);
api.post(
  "/cart/items",
  authenticate,
  validate(schemas.cartSchema),
  commerce.addItem,
);
api.put(
  "/cart/items/:id",
  authenticate,
  validate(schemas.quantitySchema),
  commerce.updateItem,
);
api.delete("/cart/items/:id", authenticate, commerce.removeItem);
api.post("/orders", authenticate, commerce.createOrder);
api.get("/orders", authenticate, commerce.listOrders);
api.get("/orders/:id", authenticate, commerce.getOrder);
api.post(
  "/quotes",
  authenticate,
  validate(schemas.quoteSchema),
  commerce.createQuote,
);
api.get("/quotes", authenticate, commerce.listQuotes);
api.get("/admin/stats", ...admin, async (req, res) => res.json(await stats()));
api.get("/admin/products", ...admin, async (req, res) =>
  res.json(await listProducts(req.query, true)),
);
api.get("/admin/stock", ...admin, async (req, res) =>
  res.json(await listProducts({}, true)),
);
api.get("/admin/orders", ...admin, async (req, res) =>
  res.json(await listOrders(req.user, true)),
);
api.patch(
  "/admin/orders/:id/status",
  ...admin,
  validate(schemas.statusSchema),
  async (req, res) =>
    res.json(
      await changeStatus(Number(req.params.id), req.data.status, req.user),
    ),
);
api.get("/admin/customers", ...admin, async (req, res) =>
  res.json(await customers()),
);
api.get("/admin/quotes", ...admin, async (req, res) =>
  res.json(await listQuotes()),
);
api.patch(
  "/admin/quotes/:id/status",
  ...admin,
  validate(schemas.quoteStatusSchema),
  async (req, res) =>
    res.json(await updateQuote(Number(req.params.id), req.data.status)),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 0,
  },
});
api.post("/uploads", ...admin, upload.single("image"), async (req, res) => {
  const b = req.file?.buffer;
  assert(b?.length >= 12, 400, "Seleccioná una imagen PNG, JPEG o WebP.");
  let extension;
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    extension = "png";
  else if (b[0] === 255 && b[1] === 216 && b[2] === 255) extension = "jpg";
  else if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  )
    extension = "webp";
  assert(extension, 400, "Formato inválido. Solo PNG, JPEG o WebP.");
  res.status(201).json({
    url: await saveImage(b, extension, uploadsDir),
  });
});
