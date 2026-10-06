import { Package, ArrowRight, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { money, statusLabel } from "../utils/format";

export function Loading() {
  return (
    <div
      className="flex items-center justify-center gap-3 py-12 text-[13px] text-ink-soft"
      role="status"
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-primary" />
      Cargando…
    </div>
  );
}

export function ErrorBox({ message }) {
  return message ? (
    <div
      className="my-4 rounded-lg border border-[#fad6d1] bg-[#fff1f0] px-4 py-3 text-[13px] leading-relaxed break-words text-[#a02b29]"
      role="alert"
    >
      {message}
    </div>
  ) : null;
}

export function Empty({
  title = "Todavía no hay productos",
  description = "Estamos preparando el catálogo. Volvé pronto para descubrir las novedades.",
  action,
}) {
  return (
    <div className="tw-card px-5 py-11 text-center text-[#8a95a7]">
      <Package size={38} className="mx-auto text-primary" />
      <h3 className="mt-4 mb-2 text-base font-semibold text-navy">{title}</h3>
      <p className="mx-auto mb-4 max-w-md text-[13px] leading-relaxed">
        {description}
      </p>
      {action}
    </div>
  );
}

export function ProductImage({ product, className = "" }) {
  return (
    <div
      className={`relative grid aspect-square place-items-center overflow-hidden bg-cloud text-[#acb6c8] ${className}`}
    >
      {product.image ? (
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 z-10 h-full w-full object-contain bg-[#f3f8ff]"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <Package size={48} />
    </div>
  );
}

export function ProductCard({ product }) {
  const inStock = product.stock > 0;
  return (
    <article className="tw-card transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link
        to={`/productos/${product.id}`}
        className="relative block overflow-hidden"
      >
        <ProductImage product={product} />
        {product.type === "IMPRESION_3D" && (
          <span className="absolute top-3 left-3 z-20 rounded-md bg-[#fff0bc] px-2 py-1 text-[9px] font-semibold text-[#674500]">
            Impresión 3D
          </span>
        )}
      </Link>
      <div className="p-4">
        <span className="tw-eyebrow text-[8px] text-ink-soft">
          {product.subcategory_name || product.category_name}
        </span>
        <Link to={`/productos/${product.id}`}>
          <h3 className="mt-2 mb-4 text-sm font-semibold break-words text-navy">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-center justify-between gap-2">
          <div>
            <strong className="text-lg font-bold tracking-tight text-navy">
              {money(product.price)}
            </strong>
            <small
              className={`mt-1 block text-[10px] ${product.type === "PERSONALIZADO" || inStock ? "text-brand-green" : "text-ink-soft"}`}
            >
              {product.type === "PERSONALIZADO"
                ? "A pedido"
                : inStock
                  ? "Disponible"
                  : "Sin stock"}
            </small>
          </div>
          <Link
            className="inline-flex min-h-[35px] min-w-[35px] items-center justify-center rounded-lg border border-line bg-[#e8f3ff] p-2 text-primary transition hover:bg-cloud"
            to={`/productos/${product.id}`}
            aria-label={`Ver ${product.name}`}
          >
            <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }) {
  return products.length ? (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  ) : (
    <Empty />
  );
}

const STATUS_STYLES = {
  pendiente: "bg-[#fff1cc] text-[#825000]",
  confirmado: "bg-[#e1efff] text-primary",
  en_preparacion: "bg-[#e1efff] text-primary",
  en_revision: "bg-[#e1efff] text-primary",
  entregado: "bg-[#dff9e9] text-[#00664c]",
  listo: "bg-[#dff9e9] text-[#00664c]",
  contactado: "bg-[#dff9e9] text-[#00664c]",
  cancelado: "bg-[#ffe7eb] text-[#ad2434]",
};

export function Badge({ status }) {
  const key = status.toLowerCase();
  return (
    <span className={`tw-badge ${STATUS_STYLES[key] ?? "bg-cloud text-ink-soft"}`}>
      {statusLabel(status)}
    </span>
  );
}

export function StockBadge({ product }) {
  const style =
    product.stock === 0
      ? "bg-[#ffe7eb] text-[#ad2434]"
      : product.stock <= product.min_stock
        ? "bg-[#fff1cc] text-[#825000]"
        : "bg-[#dff9e9] text-[#00664c]";
  const label =
    product.stock === 0
      ? "Sin stock"
      : product.stock <= product.min_stock
        ? "Stock bajo"
        : "Disponible";
  return <span className={`tw-badge ${style}`}>{label}</span>;
}

export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {eyebrow && (
          <span className="tw-eyebrow text-primary">{eyebrow}</span>
        )}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-ink-soft">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function LoginPrompt() {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#e8f3ff] px-4 py-3 text-[13px] text-[#235187]">
      <ShoppingBag size={20} className="shrink-0" />
      <p>
        Para agregar productos y realizar pedidos,{" "}
        <Link to="/login" className="font-semibold underline">
          iniciá sesión
        </Link>{" "}
        o{" "}
        <Link to="/registro" className="font-semibold underline">
          creá tu cuenta
        </Link>
        .
      </p>
    </div>
  );
}
