import { z } from "zod";
import { internationalPhone } from "../../shared/phone.js";
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
export const adminUserSchema = registerSchema.omit({ password: true });
export const adminPasswordSchema = z
  .object({ password: z.string().min(12).max(128) })
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
    phone: z
      .string()
      .max(40)
      .transform(internationalPhone)
      .refine(
        Boolean,
        "Ingresá tu WhatsApp con código de país, por ejemplo +54 9 11 1234 5678.",
      ),
    description: z.string().trim().min(10).max(5000),
    quantity,
    dimensions: z
      .object({
        width: z.number().positive().max(10000),
        height: z.number().positive().max(10000),
        depth: z.number().positive().max(10000),
      })
      .strict()
      .optional(),
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

export const checkoutSchema = z
  .object({
    payment_method: z.enum(["EFECTIVO", "TRANSFERENCIA"]),
    idempotency_key: z.uuid(),
    expected_subtotal: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
    expected_total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    receipt_id: z.uuid().optional(),
    bank_alias: z.string().trim().max(100).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.payment_method === "TRANSFERENCIA" &&
      (!data.receipt_id || !data.bank_alias)
    )
      ctx.addIssue({
        code: "custom",
        message: "Adjuntá el comprobante y verificá el alias de transferencia.",
      });
    if (
      data.payment_method === "EFECTIVO" &&
      (data.receipt_id || data.bank_alias)
    )
      ctx.addIssue({
        code: "custom",
        message: "El efectivo no requiere comprobante ni alias.",
      });
  });
export const paymentSettingsSchema = z
  .object({
    bank_alias: z
      .string()
      .trim()
      .min(6)
      .max(100)
      .regex(/^[a-zA-Z0-9.-]+$/, "Alias inválido."),
    cash_discount_percentage: z.number().int().min(0).max(100),
  })
  .strict();
export const receiptLinkSchema = z.object({ receipt_id: z.uuid() }).strict();
export const paymentReviewSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    expected_status: z.enum(["PENDING_PAYMENT", "PENDING_VERIFICATION"]),
    receipt_id: z.uuid().optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(
    (d) => d.status !== "REJECTED" || !!d.reason,
    "Indicá el motivo del rechazo.",
  );
export const paymentListSchema = z
  .object({
    page: z.coerce.number().int().positive().max(1000000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(15),
    search: z.string().trim().max(150).optional(),
    payment_method: z.enum(["EFECTIVO", "TRANSFERENCIA"]).optional(),
    payment_status: z
      .enum(["PENDING_PAYMENT", "PENDING_VERIFICATION", "APPROVED", "REJECTED"])
      .optional(),
    status: statusSchema.shape.status.optional(),
  })
  .strict();
