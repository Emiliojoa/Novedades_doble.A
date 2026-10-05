import { z } from "zod";
const name = z.string().trim().min(1).max(120);
const id = z.number().int().positive();
const quantity = z.number().int().min(1).max(10000);
export const registerSchema = z
  .object({
    first_name: name,
    last_name: name,
    email: z.email().trim().toLowerCase().max(254),
    phone: z.string().trim().max(40).default(""),
    password: z.string().min(12).max(128),
  })
  .strict();
export const loginSchema = z
  .object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1).max(128),
  })
  .strict();
export const categorySchema = z
  .object({ name, parent_id: id.nullable().default(null) })
  .strict();
export const productSchema = z
  .object({
    name,
    description: z.string().trim().max(5000).default(""),
    price: z.number().int().min(0).max(10000000000),
    stock: z.number().int().min(0).max(1000000),
    min_stock: z.number().int().min(0).max(1000000),
    image: z
      .string()
      .max(2048)
      .refine(
        (v) =>
          !v ||
          /^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(v) ||
          /^https:\/\/[^\s]+$/.test(v),
        "Usá una imagen subida o una URL HTTPS.",
      ),
    category_id: id,
    subcategory_id: id.nullable().default(null),
    type: z.enum(["PRODUCTO", "IMPRESION_3D", "PERSONALIZADO"]),
    active: z.boolean(),
    featured: z.boolean().default(false),
  })
  .strict();
export const cartSchema = z.object({ product_id: id, quantity }).strict();
export const quantitySchema = z.object({ quantity }).strict();
export const statusSchema = z
  .object({
    status: z.enum([
      "PENDIENTE",
      "CONFIRMADO",
      "EN_PREPARACION",
      "LISTO",
      "ENTREGADO",
      "CANCELADO",
    ]),
  })
  .strict();
export const quoteSchema = z
  .object({
    name,
    description: z.string().trim().min(10).max(5000),
    quantity,
    reference: z
      .string()
      .max(2048)
      .refine(
        (v) => !v || /^https:\/\/[^\s]+$/.test(v),
        "La referencia debe ser un enlace HTTPS.",
      )
      .default(""),
  })
  .strict();
export const quoteStatusSchema = z
  .object({
    status: z.enum(["PENDIENTE", "EN_REVISION", "CONTACTADO", "CERRADO"]),
  })
  .strict();
