import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShoppingBag, Check, Box } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { money } from "../utils/format";
import { ErrorBox, Loading, ProductImage } from "../components/UI";
export default function Product() {
  const { id } = useParams(),
    { data: p, loading, error } = useApi(`/products/${id}`);
  const { user, refreshCart } = useAuth();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [added, setAdded] = useState(false);
  async function add() {
    if (!user) {
      navigate(
        `/login?next=${encodeURIComponent(`/productos/${id}`)}&reason=cart`,
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api("/cart/items", {
        method: "POST",
        body: { product_id: p.id, quantity },
      });
      await refreshCart();
      setAdded(true);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wrap page">
      <Link className="text-link back" to="/productos">
        <ArrowLeft size={17} />
        Volver al catálogo
      </Link>
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : (
        p && (
          <div className="product-detail">
            <ProductImage product={p} />
            <div>
              <span className="eyebrow blue">
                {p.category_name}
                {p.subcategory_name && ` / ${p.subcategory_name}`}
              </span>
              <h1>{p.name}</h1>
              <p className="detail-price">{money(p.price)}</p>
              <span className={p.stock > 0 ? "available" : "muted"}>
                {p.stock > 0
                  ? `${p.stock} unidades disponibles`
                  : "Sin stock por el momento"}
              </span>
              <p className="description">
                {p.description ||
                  "Consultanos para conocer más sobre este producto."}
              </p>
              {p.type === "PERSONALIZADO" ? (
                <Link
                  className="button primary"
                  to="/impresiones-3d#personalizado"
                >
                  Solicitar presupuesto <Box size={18} />
                </Link>
              ) : (
                <>
                  <label className="quantity-label">
                    Cantidad
                    <input
                      type="number"
                      min="1"
                      max={p.stock || 1}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </label>
                  <button
                    className="button primary full"
                    onClick={add}
                    disabled={
                      busy ||
                      !p.stock ||
                      quantity < 1 ||
                      !Number.isInteger(quantity) ||
                      quantity > p.stock
                    }
                  >
                    <ShoppingBag size={19} />
                    {busy ? "Agregando…" : "Agregar al carrito"}
                  </button>
                  {!user && (
                    <p className="hint">
                      Necesitás iniciar sesión o registrarte para comprar.
                    </p>
                  )}
                </>
              )}
              <ErrorBox message={message} />
              {added && (
                <div className="success">
                  <Check size={18} /> Agregado a tu carrito.{" "}
                  <Link to="/carrito">Ver carrito</Link>
                </div>
              )}
              <div className="detail-note">
                <Box size={22} />
                <span>
                  Tu pedido, con atención personalizada.
                  <small>Coordinamos los detalles después de recibirlo.</small>
                </span>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
