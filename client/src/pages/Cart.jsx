import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Minus, Plus, ArrowRight } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { money } from "../utils/format";
import {
  Empty,
  ErrorBox,
  Loading,
  PageHeading,
  ProductImage,
} from "../components/UI";
export default function Cart() {
  const { data, loading, error, refresh } = useApi("/cart");
  const { refreshCart } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function update(path, method, body) {
    setBusy(true);
    setMessage("");
    try {
      await api(path, { method, body });
      refresh();
      await refreshCart();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    setBusy(true);
    setMessage("");
    try {
      const order = await api("/orders", { method: "POST" });
      await refreshCart();
      navigate(`/pedidos/${order.id}?created=true`);
    } catch (e) {
      setMessage(e.message);
      refresh();
    } finally {
      setBusy(false);
    }
  }
  const invalid = data?.items.some((p) => !p.active || p.quantity > p.stock);
  return (
    <div className="wrap page">
      <PageHeading
        eyebrow="UN PASO MÁS CERCA"
        title="Tu carrito"
        description="Revisá tus productos antes de confirmar el pedido."
      />
      <ErrorBox message={error || message} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <div className="cart-layout">
          <div>
            {data.items.map((p) => (
              <article className="cart-item" key={p.id}>
                <Link to={`/productos/${p.product_id}`}>
                  <ProductImage product={p} />
                </Link>
                <div className="cart-item-name">
                  <Link to={`/productos/${p.product_id}`}>
                    <h3>{p.name}</h3>
                  </Link>
                  <span>{money(p.price)} por unidad</span>
                  {(!p.active || p.quantity > p.stock) && (
                    <small className="danger">
                      {!p.active
                        ? "Producto no disponible"
                        : `Solo quedan ${p.stock} unidades`}
                    </small>
                  )}
                  <div className="quantity-control">
                    <button
                      disabled={busy || p.quantity <= 1}
                      aria-label={`Reducir cantidad de ${p.name}`}
                      onClick={() =>
                        update(`/cart/items/${p.id}`, "PUT", {
                          quantity: p.quantity - 1,
                        })
                      }
                    >
                      <Minus size={15} />
                    </button>
                    <span>{p.quantity}</span>
                    <button
                      disabled={busy || p.quantity >= p.stock || !p.active}
                      aria-label={`Aumentar cantidad de ${p.name}`}
                      onClick={() =>
                        update(`/cart/items/${p.id}`, "PUT", {
                          quantity: p.quantity + 1,
                        })
                      }
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
                <div className="cart-item-end">
                  <strong>{money(p.price * p.quantity)}</strong>
                  <button
                    className="icon-button danger"
                    disabled={busy}
                    aria-label={`Eliminar ${p.name}`}
                    onClick={() => update(`/cart/items/${p.id}`, "DELETE")}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))}
            <button
              className="text-link danger"
              disabled={busy}
              onClick={() => update("/cart", "DELETE")}
            >
              Vaciar carrito
            </button>
          </div>
          <aside className="panel order-summary">
            <h2>Resumen del pedido</h2>
            <div>
              <span>Productos</span>
              <span>{data.items.reduce((s, p) => s + p.quantity, 0)}</span>
            </div>
            <div className="summary-total">
              <strong>Total</strong>
              <strong>{money(data.total)}</strong>
            </div>
            <p>
              Al confirmar, registramos tu pedido. La entrega y el pago se
              coordinan posteriormente con el local.
            </p>
            <button
              className="button primary full"
              disabled={busy || invalid}
              onClick={checkout}
            >
              {busy ? "Procesando…" : "Confirmar pedido"}
              <ArrowRight size={18} />
            </button>
            <small>
              El precio y la disponibilidad se verifican al confirmar.
            </small>
          </aside>
        </div>
      ) : (
        !error && (
          <Empty
            title="Tu carrito está esperando"
            description="Explorá el catálogo y agregá tus próximos favoritos."
            action={
              <Link className="button primary" to="/productos">
                Explorar productos <ArrowRight size={18} />
              </Link>
            }
          />
        )
      )}
    </div>
  );
}
