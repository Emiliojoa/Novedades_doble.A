import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { LogOut, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useApi } from "../hooks/useApi";
import { api } from "../services/api";
import { money, date, statusLabel } from "../utils/format";
import { Badge, Empty, ErrorBox, Loading, PageHeading } from "../components/UI";
export function OrdersTable({ orders, admin = false }) {
  return orders.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Fecha</th>
            {admin && <th>Cliente</th>}
            <th>Total</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>#{String(o.id).padStart(5, "0")}</td>
              <td>{date(o.created_at)}</td>
              {admin && (
                <td>
                  {o.first_name} {o.last_name}
                  <small>{o.email}</small>
                </td>
              )}
              <td>{money(o.total)}</td>
              <td>
                <Badge status={o.status} />
              </td>
              <td>
                <Link
                  className="text-link"
                  to={`${admin ? "/admin" : ""}/pedidos/${o.id}`}
                >
                  Ver <ArrowUpRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="Todavía no hay pedidos"
      description="Los pedidos aparecerán aquí cuando se confirmen."
    />
  );
}
export default function Account() {
  const { user, logout } = useAuth();
  const orders = useApi("/orders"),
    quotes = useApi("/quotes");
  const navigate = useNavigate();
  const [error, setError] = useState("");
  return (
    <div className="wrap page">
      <PageHeading
        eyebrow="MI CUENTA"
        title={`Hola, ${user.first_name}.`}
        description="Tus datos, tus pedidos y tus próximas ideas."
      >
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await logout();
              navigate("/");
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <LogOut size={17} />
          Cerrar sesión
        </button>
      </PageHeading>
      <ErrorBox message={error} />
      <div className="account-info panel">
        <strong>
          {user.first_name} {user.last_name}
        </strong>
        <span>{user.email}</span>
        <span>{user.phone || "Sin teléfono registrado"}</span>
        {user.role === "ADMIN" && (
          <Link className="text-link" to="/admin">
            Ir al panel de administración <ArrowUpRight size={17} />
          </Link>
        )}
      </div>
      <h2 className="subheading">Mis pedidos</h2>
      <ErrorBox message={orders.error} />
      {orders.loading ? (
        <Loading />
      ) : (
        orders.data && <OrdersTable orders={orders.data} />
      )}
      <h2 className="subheading">Mis solicitudes de impresión 3D</h2>
      <ErrorBox message={quotes.error} />
      {quotes.loading ? (
        <Loading />
      ) : quotes.data?.length ? (
        <div className="quote-list">
          {quotes.data.map((q) => (
            <div className="panel" key={q.id}>
              <Badge status={q.status} />
              <h3>{q.name}</h3>
              <p className="description">{q.description}</p>
              {q.reference && (
                <p>
                  <a
                    className="text-link"
                    href={q.reference}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver referencia
                  </a>
                </p>
              )}
              <small>
                {q.quantity} unidades · {date(q.created_at)}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          Aún no enviaste solicitudes.{" "}
          <Link className="text-link" to="/impresiones-3d#personalizado">
            Contanos tu idea
          </Link>
        </p>
      )}
    </div>
  );
}
const transitions = {
  PENDIENTE: ["CONFIRMADO", "CANCELADO"],
  CONFIRMADO: ["EN_PREPARACION", "CANCELADO"],
  EN_PREPARACION: ["LISTO", "CANCELADO"],
  LISTO: ["ENTREGADO", "CANCELADO"],
  ENTREGADO: [],
  CANCELADO: [],
};
export function OrderDetail({ admin = false }) {
  const { id } = useParams();
  const { data: o, loading, error, refresh } = useApi(`/orders/${id}`);
  const [params] = useSearchParams();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function status(value) {
    if (
      value === "CANCELADO" &&
      !window.confirm("¿Cancelar este pedido y devolver sus unidades al stock?")
    )
      return;
    setBusy(true);
    try {
      await api(`/admin/orders/${id}/status`, {
        method: "PATCH",
        body: { status: value },
      });
      refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={admin ? "" : "wrap page"}>
      <Link className="text-link" to={admin ? "/admin/pedidos" : "/perfil"}>
        ← Volver a los pedidos
      </Link>
      <ErrorBox message={error || message} />
      {loading ? (
        <Loading />
      ) : (
        o && (
          <>
            {params.has("created") && (
              <div className="success">
                <CheckCircle2 size={20} />
                ¡Recibimos tu pedido! Ya podés ver sus detalles.
              </div>
            )}
            <PageHeading
              eyebrow={date(o.created_at)}
              title={`Pedido #${String(o.id).padStart(5, "0")}`}
            >
              <Badge status={o.status} />
            </PageHeading>
            <div className="order-customer panel">
              <h3>
                {admin ? "Cliente asociado al pedido" : "Datos del pedido"}
              </h3>
              <p>
                {o.first_name} {o.last_name}
              </p>
              <p>{o.email}</p>
              {o.phone && <p>{o.phone}</p>}
              <p className="hint">
                El pago y la entrega se coordinan con el local.
              </p>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio unitario</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.name}</td>
                      <td>{i.quantity}</td>
                      <td>{money(i.unit_price)}</td>
                      <td>{money(i.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="order-total">
              Total del pedido <strong>{money(o.total)}</strong>
            </div>
            {admin && (
              <div className="panel">
                <h3>Actualizar estado</h3>
                {transitions[o.status]?.length ? (
                  <div className="button-row">
                    {transitions[o.status].map((s) => (
                      <button
                        key={s}
                        className={`button ${s === "CANCELADO" ? "secondary danger" : "primary"}`}
                        disabled={busy}
                        onClick={() => status(s)}
                      >
                        {statusLabel(s)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>Este pedido está cerrado.</p>
                )}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
