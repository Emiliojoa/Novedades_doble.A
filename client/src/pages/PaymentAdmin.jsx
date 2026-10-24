import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../services/api";
import { PageHeading, Loading, ErrorBox } from "../components/UI";
import { OrdersTable } from "./Account";
import { paymentLabels, methodLabels } from "../../../shared/payments";
import { statusLabel } from "../utils/format";

export function PaymentOrders() {
  const [params, setParams] = useSearchParams();
  const query = new URLSearchParams();
  for (const key of [
    "page",
    "search",
    "payment_method",
    "payment_status",
    "status",
  ])
    if (params.get(key)) query.set(key, params.get(key));
  const { data, loading, error, refresh } = useApi(`/admin/payments?${query}`);
  useEffect(() => {
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  const page = Number(params.get("page") || 1);
  function filter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "search" });
  }
  return (
    <>
      <PageHeading
        title="Pedidos"
        description="Pedidos y pagos: importes, comprobantes y verificación administrativa."
      >
        <button className="button secondary" onClick={refresh}>
          Actualizar
        </button>
      </PageHeading>
      {data && (
        <div className="payment-counters" aria-live="polite">
          <span>
            <strong>{data.counters.pending_payment}</strong> pendientes de pago
          </span>
          <span>
            <strong>{data.counters.pending_verification}</strong> transferencias
            por revisar
          </span>
        </div>
      )}
      <div className="payment-filters">
        <label>
          Buscar pedido o cliente
          <input
            type="search"
            maxLength={150}
            value={params.get("search") || ""}
            onChange={(e) => filter("search", e.target.value)}
            placeholder="Número, nombre o email"
          />
        </label>
        <div>
          <label htmlFor="filter-method">Método de pago</label>
          <select
            id="filter-method"
            value={params.get("payment_method") || ""}
            onChange={(e) => filter("payment_method", e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(methodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-payment-state">Estado del pago</label>
          <select
            id="filter-payment-state"
            value={params.get("payment_status") || ""}
            onChange={(e) => filter("payment_status", e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(paymentLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-order-state">Estado del pedido</label>
          <select
            id="filter-order-state"
            value={params.get("status") || ""}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">Todos</option>
            {[
              "PENDIENTE",
              "CONFIRMADO",
              "EN_PREPARACION",
              "LISTO",
              "ENTREGADO",
              "CANCELADO",
            ].map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <OrdersTable orders={data.orders} admin />
            <nav className="payment-pagination" aria-label="Páginas de pedidos">
              <button
                className="button secondary"
                disabled={page <= 1}
                onClick={() => filter("page", String(page - 1))}
              >
                Anterior
              </button>
              <span>
                Página {page} de{" "}
                {Math.max(1, Math.ceil(data.total / data.limit))} · {data.total}{" "}
                pedidos
              </span>
              <button
                className="button secondary"
                disabled={page * data.limit >= data.total}
                onClick={() => filter("page", String(page + 1))}
              >
                Siguiente
              </button>
            </nav>
          </>
        )
      )}
    </>
  );
}
function SettingsForm({ config }) {
  const [alias, setAlias] = useState(config.bank_alias),
    [discount, setDiscount] = useState(config.cash_discount_percentage),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  return (
    <form
      className="panel payment-settings"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        setSaved(false);
        try {
          await api("/admin/payment-settings", {
            method: "PUT",
            body: {
              bank_alias: alias,
              cash_discount_percentage: Number(discount),
            },
          });
          setSaved(true);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Transferencia bancaria</h2>
      <label>
        Alias bancario
        <input
          required
          minLength={6}
          maxLength={100}
          pattern="[a-zA-Z0-9.\-]+"
          value={alias}
          onChange={(e) => {
            setAlias(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      <h2>Pago en efectivo</h2>
      <label>
        Porcentaje de descuento
        <input
          type="number"
          required
          min={0}
          max={100}
          step={1}
          value={discount}
          onChange={(e) => {
            setDiscount(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      <p>
        Los cambios se aplican únicamente a nuevas compras. Los pedidos
        registrados conservan su alias, descuento e importes originales.
      </p>
      <ErrorBox message={error} />
      {saved && (
        <p className="success" role="status">
          Configuración de pagos guardada.
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? "Guardando…" : "Guardar configuración"}
      </button>
    </form>
  );
}
export default function PaymentSettings() {
  const { data, loading, error } = useApi("/payment-settings");
  return (
    <>
      <PageHeading
        title="Configuración de pagos"
        description="Alias de transferencia y descuento por efectivo."
      />
      <ErrorBox message={error} />
      {loading ? <Loading /> : data && <SettingsForm config={data} />}
    </>
  );
}
