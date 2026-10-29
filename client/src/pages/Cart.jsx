import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { PaymentSelector, PaymentSummary } from "../components/Payments";
import { paymentAmounts } from "../../../shared/payments";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Minus, Plus, ArrowRight, X, ArrowLeft } from "lucide-react";
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
  const { refreshCart, user } = useAuth();
  const config = useApi("/payment-settings");
  const [method, setMethod] = useState("");
  const [receipt, setReceipt] = useState(null),
    [uploadBusy, setUploadBusy] = useState(false);
  const attemptKey = `checkout-attempt-${user.id}`;
  const [attempt, setAttempt] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(attemptKey) || "null");
    } catch {
      return null;
    }
  });
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [step, setStep] = useState(1);
  const requestLock = useRef(false);
  const amounts = paymentAmounts(
    data?.total || 0,
    method === "EFECTIVO" ? config.data?.cash_discount_percentage || 0 : 0,
  );
  const locked = !!attempt;
  function clearAttempt() {
    sessionStorage.removeItem(attemptKey);
    setAttempt(null);
  }
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function update(path, method, body) {
    if (requestLock.current || locked || uploadBusy) return;
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
    if (requestLock.current || uploadBusy) return;
    if (!attempt && (!method || (method === "TRANSFERENCIA" && !receipt))) {
      setMessage(
        !method
          ? "Seleccioná un método de pago."
          : "Adjuntá el comprobante para confirmar la transferencia.",
      );
      return;
    }
    requestLock.current = true;
    setBusy(true);
    setMessage("");
    const body = attempt || {
      payment_method: method,
      idempotency_key: crypto.randomUUID(),
      expected_subtotal: amounts.subtotal,
      expected_total: amounts.total,
      ...(method === "TRANSFERENCIA"
        ? { receipt_id: receipt.id, bank_alias: config.data.bank_alias }
        : {}),
    };
    try {
      sessionStorage.setItem(attemptKey, JSON.stringify(body));
      setAttempt(body);
      const order = await api("/orders", { method: "POST", body });
      clearAttempt();
      if (method === "EFECTIVO" && receipt)
        api(`/payment-receipts/${receipt.id}`, { method: "DELETE" }).catch(
          () => {},
        );
      await refreshCart().catch(() => {});
      navigate(`/pedidos/${order.id}?created=true`);
    } catch (e) {
      setMessage(
        e.status
          ? e.message
          : "No pudimos confirmar la respuesta. Reintentá con el botón de recuperación para evitar duplicar el pedido.",
      );
      if (!e.status || e.status >= 500) setPaymentOpen(false);
      if (e.status && e.status < 500) {
        clearAttempt();
        refresh();
        config.refresh();
      }
    } finally {
      requestLock.current = false;
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
      <ErrorBox message={error || message || config.error} />
      {attempt && (
        <div className="panel">
          <p>
            Hay una confirmación pendiente de respuesta. Podés reintentar sin
            generar otro pedido.
          </p>
          <button className="button primary" disabled={busy} onClick={checkout}>
            Recuperar confirmación del pedido
          </button>
        </div>
      )}
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
                      disabled={busy || locked || uploadBusy || p.quantity <= 1}
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
                      disabled={
                        busy ||
                        locked ||
                        uploadBusy ||
                        p.quantity >= p.stock ||
                        !p.active
                      }
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
                    disabled={busy || locked || uploadBusy}
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
              disabled={busy || locked || uploadBusy}
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
              <span>Subtotal</span>
              <strong>{money(data.total)}</strong>
            </div>
            {!!config.data?.cash_discount_percentage && (
              <p>
                Pagando en efectivo: {config.data.cash_discount_percentage}% de
                descuento.
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy || locked || invalid || !config.data || loading}
              onClick={() => {
                setStep(1);
                setMessage("");
                setPaymentOpen(true);
              }}
            >
              Continuar al pago <ArrowRight size={18} />
            </button>
            {invalid && (
              <p className="danger" role="alert">
                Hay productos sin disponibilidad. Revisalos antes de continuar.
              </p>
            )}
            <small>
              El precio y la disponibilidad se verifican al confirmar.
            </small>
          </aside>
          <Dialog
            open={paymentOpen}
            onClose={() => {
              if (!busy && !uploadBusy) setPaymentOpen(false);
            }}
            maxWidth="md"
            fullWidth
            scroll="paper"
            className="checkout-modal"
            aria-labelledby="checkout-title"
          >
            <DialogTitle component="div" className="checkout-heading">
              <div>
                <small>Paso {step} de 2</small>
                <h2 id="checkout-title">
                  {step === 1
                    ? "Elegir medio de pago"
                    : method === "TRANSFERENCIA"
                      ? "Transferir y adjuntar comprobante"
                      : "Confirmar tu pedido"}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Cerrar pago"
                disabled={busy || uploadBusy}
                onClick={() => setPaymentOpen(false)}
              >
                <X size={22} />
              </button>
            </DialogTitle>
            <DialogContent dividers className="checkout-content">
              <ErrorBox message={message || config.error} />
              {config.data && (
                <PaymentSelector
                  config={config.data}
                  subtotal={data.total}
                  method={method}
                  setMethod={setMethod}
                  receipt={receipt}
                  setReceipt={(value) => {
                    setReceipt(value);
                    setMessage("");
                  }}
                  disabled={busy || locked || uploadBusy}
                  onUploadBusy={setUploadBusy}
                  stage={step === 1 ? "method" : "details"}
                />
              )}
              {step === 2 && (
                <>
                  {method === "EFECTIVO" && (
                    <p className="notice">
                      Pagás en efectivo al coordinar con el local. No hace falta
                      un comprobante.
                    </p>
                  )}
                  {method === "EFECTIVO" && (
                    <PaymentSummary
                      order={{ ...amounts, payment_method: method }}
                    />
                  )}
                  <p className="hint">
                    La entrega se coordina con el local. Las transferencias se
                    verifican antes de confirmar el pago.
                  </p>
                </>
              )}
            </DialogContent>
            <DialogActions className="checkout-footer">
              <div>
                <small>Total a pagar</small>
                <strong>{money(amounts.total)}</strong>
              </div>
              <div className="button-row">
                {step === 2 && (
                  <button
                    className="button secondary"
                    disabled={busy || uploadBusy || locked}
                    onClick={() => {
                      setStep(1);
                      setMessage("");
                    }}
                  >
                    <ArrowLeft size={16} />
                    Volver
                  </button>
                )}
                <button
                  className="button primary"
                  disabled={
                    busy ||
                    uploadBusy ||
                    locked ||
                    invalid ||
                    !method ||
                    !config.data ||
                    loading
                  }
                  onClick={step === 1 ? () => setStep(2) : checkout}
                >
                  {busy
                    ? "Procesando..."
                    : step === 1
                      ? "Continuar"
                      : "Confirmar pedido"}
                  <ArrowRight size={18} />
                </button>
              </div>
            </DialogActions>
          </Dialog>
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
