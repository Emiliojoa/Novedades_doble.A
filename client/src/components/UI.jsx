import { Package, ArrowRight, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { money, statusLabel } from "../utils/format";
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Cargando…
    </div>
  );
}
export function ErrorBox({ message }) {
  return message ? (
    <div className="error" role="alert">
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
    <div className="empty">
      <Package size={38} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ProductImage({ product, className = "" }) {
  return (
    <div className={`product-image ${className}`}>
      {product.image ? (
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement.classList.add("image-failed");
          }}
        />
      ) : null}
      <Package className="image-placeholder" size={48} />
    </div>
  );
}
export function ProductCard({ product }) {
  return (
    <article className="product-card">
      <Link to={`/productos/${product.id}`} className="product-picture">
        <ProductImage product={product} />
        {product.type === "IMPRESION_3D" && (
          <span className="product-tag">Impresión 3D</span>
        )}
      </Link>
      <div className="product-copy">
        <span className="eyebrow muted">
          {product.subcategory_name || product.category_name}
        </span>
        <Link to={`/productos/${product.id}`}>
          <h3>{product.name}</h3>
        </Link>
        <div className="product-bottom">
          <div>
            <strong>{money(product.price)}</strong>
            <small className={product.stock > 0 ? "available" : "muted"}>
              {product.type === "PERSONALIZADO"
                ? "A pedido"
                : product.stock > 0
                  ? "Disponible"
                  : "Sin stock"}
            </small>
          </div>
          <Link
            className="icon-button"
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
    <div className="product-grid">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  ) : (
    <Empty />
  );
}
export function Badge({ status }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      {statusLabel(status)}
    </span>
  );
}
export function StockBadge({ product }) {
  return (
    <span
      className={`badge ${product.stock === 0 ? "badge-cancelado" : product.stock <= product.min_stock ? "badge-pendiente" : "badge-entregado"}`}
    >
      {product.stock === 0
        ? "Sin stock"
        : product.stock <= product.min_stock
          ? "Stock bajo"
          : "Disponible"}
    </span>
  );
}
export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow blue">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function LoginPrompt() {
  return (
    <div className="notice">
      <ShoppingBag size={20} />
      <p>
        Para agregar productos y realizar pedidos,{" "}
        <Link to="/login">iniciá sesión</Link> o{" "}
        <Link to="/registro">creá tu cuenta</Link>.
      </p>
    </div>
  );
}
