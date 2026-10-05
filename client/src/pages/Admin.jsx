import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Boxes,
  Users,
  ClipboardList,
  ArrowUpRight,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../services/api";
import {
  Badge,
  Empty,
  ErrorBox,
  Loading,
  PageHeading,
  ProductImage,
  StockBadge,
} from "../components/UI";
import { OrdersTable } from "./Account";
import { date, money } from "../utils/format";

export function Dashboard() {
  const { data, loading, error } = useApi("/admin/stats");
  return (
    <>
      <PageHeading eyebrow="TU NEGOCIO, DE UN VISTAZO" title="Resumen general">
        <Link className="button primary" to="/admin/productos">
          <Plus size={18} />
          Gestionar productos
        </Link>
      </PageHeading>
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stat-grid">
              {[
                [Package, "Productos activos", data.products],
                [Boxes, "Stock bajo o agotado", data.low_stock],
                [ClipboardList, "Pedidos pendientes", data.pending],
                [Users, "Clientes registrados", data.clients],
              ].map(([Icon, label, value]) => (
                <article className="panel stat" key={label}>
                  <Icon size={21} />
                  <span>{label}</span>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
            <div className="dashboard-summary">
              <span>
                Pedidos totales <strong>{data.orders}</strong>
              </span>
              <span>
                Importe de pedidos entregados{" "}
                <strong>{money(data.sales)}</strong>
              </span>
            </div>
            <div className="section-heading">
              <h2>Pedidos recientes</h2>
              <Link className="text-link" to="/admin/pedidos">
                Ver todos <ArrowUpRight size={17} />
              </Link>
            </div>
            <OrdersTable orders={data.recent} admin />
          </>
        )
      )}
    </>
  );
}

const blankProduct = {
  name: "",
  description: "",
  price: 0,
  stock: 0,
  min_stock: 5,
  image: "",
  category_id: "",
  subcategory_id: "",
  type: "PRODUCTO",
  active: true,
  featured: false,
};
export function AdminProducts() {
  const products = useApi("/admin/products"),
    categories = useApi("/categories");
  const [editing, setEditing] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { id, price, ...rest } = editing;
      const body = {
        ...rest,
        price: Math.round(Number(price) * 100),
        stock: Number(rest.stock),
        min_stock: Number(rest.min_stock),
        category_id: Number(rest.category_id),
        subcategory_id: rest.subcategory_id
          ? Number(rest.subcategory_id)
          : null,
      };
      await api(`/products${id ? "/" + id : ""}`, {
        method: id ? "PUT" : "POST",
        body,
      });
      setEditing(null);
      products.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function edit(p) {
    setError("");
    setEditing({
      ...Object.fromEntries(
        Object.keys(blankProduct).map((k) => [k, p[k] ?? blankProduct[k]]),
      ),
      price: p.price / 100,
      id: p.id,
    });
  }
  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      const result = await api("/uploads", { method: "POST", body: form });
      setEditing((p) => ({ ...p, image: result.url }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function deactivate(p) {
    if (
      !window.confirm(
        `¿Desactivar ${p.name}? Dejará de mostrarse en la tienda.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/products/${p.id}`, { method: "DELETE" });
      products.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const change = (key, value) =>
    setEditing((p) => ({
      ...p,
      [key]: value,
      ...(key === "category_id" ? { subcategory_id: "" } : {}),
    }));
  return (
    <>
      <PageHeading
        title="Productos"
        description="Administrá tu catálogo, precios y disponibilidad."
      >
        <button
          className="button primary"
          onClick={() => {
            setEditing({ ...blankProduct });
            setError("");
          }}
        >
          <Plus size={18} />
          Nuevo producto
        </button>
      </PageHeading>
      <ErrorBox
        message={products.error || categories.error || (!editing && error)}
      />
      {editing && (
        <form className="panel editor" onSubmit={save}>
          <div className="section-heading">
            <h2>{editing.id ? "Editar producto" : "Nuevo producto"}</h2>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Cerrar
            </button>
          </div>
          <ErrorBox message={error} />
          <div className="form-grid">
            <label>
              Nombre
              <input
                value={editing.name}
                required
                maxLength={120}
                onChange={(e) => change("name", e.target.value)}
              />
            </label>
            <label>
              Tipo
              <select
                value={editing.type}
                onChange={(e) => change("type", e.target.value)}
              >
                <option value="PRODUCTO">Producto</option>
                <option value="IMPRESION_3D">
                  Impresión 3D predeterminada
                </option>
                <option value="PERSONALIZADO">
                  Diseño personalizado (presupuesto)
                </option>
              </select>
            </label>
            <label>
              Precio minorista (ARS)
              <input
                type="number"
                min="0"
                max="100000000"
                step="0.01"
                required
                value={editing.price}
                onChange={(e) => change("price", e.target.value)}
              />
            </label>
            <label>
              Stock actual
              <input
                type="number"
                min="0"
                max="1000000"
                required
                value={editing.stock}
                onChange={(e) => change("stock", e.target.value)}
              />
            </label>
            <label>
              Stock mínimo
              <input
                type="number"
                min="0"
                max="1000000"
                required
                value={editing.min_stock}
                onChange={(e) => change("min_stock", e.target.value)}
              />
            </label>
            <label>
              Categoría
              <select
                required
                value={editing.category_id}
                onChange={(e) => change("category_id", e.target.value)}
              >
                <option value="">Seleccionar categoría</option>
                {categories.data
                  ?.filter((c) => !c.parent_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Subcategoría
              <select
                value={editing.subcategory_id || ""}
                onChange={(e) => change("subcategory_id", e.target.value)}
              >
                <option value="">Sin subcategoría</option>
                {categories.data
                  ?.filter((c) => c.parent_id === Number(editing.category_id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Imagen (PNG, JPEG, WebP · hasta 5 MB)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={(e) => upload(e.target.files[0])}
              />
            </label>
          </div>
          <label>
            URL de imagen HTTPS o imagen subida
            <input
              value={editing.image}
              onChange={(e) => change("image", e.target.value)}
              maxLength={2048}
            />
          </label>
          {editing.image && (
            <ProductImage product={editing} className="editor-preview" />
          )}
          <label>
            Descripción
            <textarea
              value={editing.description}
              maxLength={5000}
              rows={4}
              onChange={(e) => change("description", e.target.value)}
            />
          </label>
          <div className="button-row">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => change("active", e.target.checked)}
              />
              Activo
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={editing.featured}
                onChange={(e) => change("featured", e.target.checked)}
              />
              Destacado en inicio
            </label>
          </div>
          {!categories.data?.some((c) => !c.parent_id) && (
            <p className="notice">
              Primero <Link to="/admin/categorias">creá una categoría</Link>{" "}
              para asignar el producto.
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar producto"}
          </button>
        </form>
      )}
      <input
        className="admin-search"
        aria-label="Buscar en productos"
        placeholder="Buscar por nombre…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {products.loading ? (
        <Loading />
      ) : products.data?.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.data
                .filter((p) =>
                  p.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="table-product">
                        <ProductImage product={p} />
                        <span>
                          {p.name}
                          <small>
                            #{p.id} · {p.type}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {p.category_name}
                      <small>{p.subcategory_name}</small>
                    </td>
                    <td>{money(p.price)}</td>
                    <td>{p.stock}</td>
                    <td>
                      <span
                        className={`badge ${p.active ? "badge-entregado" : "badge-cancelado"}`}
                      >
                        {p.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div className="button-row">
                        <button
                          className="icon-button"
                          aria-label={`Editar ${p.name}`}
                          onClick={() => edit(p)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          disabled={busy || !p.active}
                          aria-label={`Desactivar ${p.name}`}
                          onClick={() => deactivate(p)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Tu catálogo comienza acá"
          description="Creá una categoría y cargá tu primer producto para publicarlo en la tienda."
        />
      )}
    </>
  );
}

export function AdminCategories() {
  const { data, loading, error, refresh } = useApi("/categories");
  const [form, setForm] = useState({ name: "", parent_id: "" }),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api(`/categories${form.id ? "/" + form.id : ""}`, {
        method: form.id ? "PUT" : "POST",
        body: {
          name: form.name,
          parent_id: form.parent_id ? Number(form.parent_id) : null,
        },
      });
      setForm({ name: "", parent_id: "" });
      refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(c) {
    if (!window.confirm(`¿Eliminar la categoría ${c.name}?`)) return;
    setBusy(true);
    try {
      await api(`/categories/${c.id}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Categorías"
        description="Organizá el catálogo en categorías y subcategorías."
      />
      <ErrorBox message={error || message} />
      <form className="panel inline-form" onSubmit={save}>
        <label>
          Nombre
          <input
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Categoría padre
          <select
            value={form.parent_id || ""}
            onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
          >
            <option value="">Ninguna (categoría principal)</option>
            {data
              ?.filter((c) => !c.parent_id && c.id !== form.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <button className="button primary" disabled={busy}>
          {form.id ? "Guardar cambios" : "Crear categoría"}
        </button>
        {form.id && (
          <button
            type="button"
            className="button secondary"
            onClick={() => setForm({ name: "", parent_id: "" })}
          >
            Cancelar
          </button>
        )}
      </form>
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría padre</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    {data.find((p) => p.id === c.parent_id)?.name ||
                      "Principal"}
                  </td>
                  <td>
                    <div className="button-row">
                      <button
                        className="icon-button"
                        aria-label={`Editar ${c.name}`}
                        onClick={() => setForm(c)}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        disabled={busy}
                        className="icon-button danger"
                        aria-label={`Eliminar ${c.name}`}
                        onClick={() => remove(c)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Creá tu primera categoría"
          description="Luego podrás agregar subcategorías y asignar tus productos."
        />
      )}
    </>
  );
}

export function AdminStock() {
  const { data, loading, error, refresh } = useApi("/admin/stock");
  const [low, setLow] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e, p) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const fields = new FormData(e.currentTarget);
    try {
      const body = Object.fromEntries(
        Object.keys(blankProduct).map((k) => [k, p[k]]),
      );
      body.stock = Number(fields.get("stock"));
      body.min_stock = Number(fields.get("min_stock"));
      await api(`/products/${p.id}`, { method: "PUT", body });
      refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Control de stock"
        description="Unidades disponibles, mínimos y últimas actualizaciones."
      />
      <ErrorBox message={error || message} />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={low}
          onChange={(e) => setLow(e.target.checked)}
        />
        Mostrar solo stock bajo o agotado
      </label>
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Actual / Mínimo</th>
                <th>Estado</th>
                <th>Última actualización</th>
              </tr>
            </thead>
            <tbody>
              {data
                .filter((p) => !low || p.stock <= p.min_stock)
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      {!p.active && <small>Inactivo</small>}
                    </td>
                    <td>{p.category_name}</td>
                    <td>
                      <form className="stock-form" onSubmit={(e) => save(e, p)}>
                        <input
                          key={`s${p.stock}`}
                          type="number"
                          name="stock"
                          aria-label={`Stock de ${p.name}`}
                          defaultValue={p.stock}
                          min="0"
                          max="1000000"
                          required
                        />
                        <span>/</span>
                        <input
                          key={`m${p.min_stock}`}
                          type="number"
                          name="min_stock"
                          aria-label={`Mínimo de ${p.name}`}
                          defaultValue={p.min_stock}
                          min="0"
                          max="1000000"
                          required
                        />
                        <button className="button secondary" disabled={busy}>
                          Guardar
                        </button>
                      </form>
                    </td>
                    <td>
                      <StockBadge product={p} />
                    </td>
                    <td>{date(p.updated_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No hay productos para controlar" />
      )}
    </>
  );
}

export function AdminOrders() {
  const { data, loading, error } = useApi("/admin/orders");
  const [status, setStatus] = useState("");
  return (
    <>
      <PageHeading
        title="Pedidos"
        description="Cada compra, sus productos y el cliente que la realizó."
      />
      <label className="admin-search">
        Filtrar estado
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          {[
            "PENDIENTE",
            "CONFIRMADO",
            "EN_PREPARACION",
            "LISTO",
            "ENTREGADO",
            "CANCELADO",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <OrdersTable
            orders={data.filter((o) => !status || o.status === status)}
            admin
          />
        )
      )}
    </>
  );
}
export function AdminCustomers() {
  const { data, loading, error } = useApi("/admin/customers");
  return (
    <>
      <PageHeading
        title="Clientes"
        description="Las personas detrás de cada pedido."
      />
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Registro</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.first_name} {u.last_name}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.phone || "—"}</td>
                  <td>{date(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Todavía no hay clientes registrados" />
      )}
    </>
  );
}
export function AdminQuotes() {
  const { data, loading, error, refresh } = useApi("/admin/quotes");
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function update(id, status) {
    setBusy(true);
    setMessage("");
    try {
      await api(`/admin/quotes/${id}/status`, {
        method: "PATCH",
        body: { status },
      });
      refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Solicitudes 3D"
        description="Revisá las ideas y contactá al cliente para preparar su presupuesto."
      />
      <ErrorBox message={error || message} />
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="quote-list">
          {data.map((q) => (
            <article className="panel" key={q.id}>
              <div className="section-heading">
                <span>Solicitud #{q.id}</span>
                <Badge status={q.status} />
              </div>
              <h2>{q.name}</h2>
              <p className="description">{q.description}</p>
              <p>
                {q.quantity} unidades · {date(q.created_at)}
              </p>
              <strong>
                {q.first_name} {q.last_name}
              </strong>
              <p>
                <a className="text-link" href={`mailto:${q.email}`}>
                  {q.email}
                </a>
              </p>
              {q.reference && (
                <p>
                  <a
                    className="text-link"
                    href={q.reference}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver referencia <ArrowUpRight size={16} />
                  </a>
                </p>
              )}
              <label>
                Estado
                <select
                  disabled={busy}
                  value={q.status}
                  onChange={(e) => update(q.id, e.target.value)}
                >
                  {["PENDIENTE", "EN_REVISION", "CONTACTADO", "CERRADO"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </label>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Todavía no hay solicitudes"
          description="Las ideas enviadas desde la sección de impresión 3D aparecerán aquí."
        />
      )}
    </>
  );
}
