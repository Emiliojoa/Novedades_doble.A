import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { ErrorBox } from "../components/UI";
import {
  Banknote,
  LayoutDashboard,
  Package,
  Boxes,
  Tags,
  ClipboardList,
  Users,
  UserRoundCog,
  Box,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { Logo } from "./StoreLayout";
import { useAuth } from "../hooks/useAuth";
const links = [
  ["", "Resumen", LayoutDashboard],
  ["productos", "Productos", Package],
  ["stock", "Stock", Boxes],
  ["categorias", "Categorías", Tags],
  ["pedidos", "Pedidos", ClipboardList],
  ["pagos", "Configuración de pagos", Banknote],
  ["clientes", "Clientes", Users],
  ["usuarios", "Usuarios", UserRoundCog],
  ["solicitudes", "Solicitudes 3D", Box],
];
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Logo />
        <span className="eyebrow muted">ADMINISTRACIÓN</span>
        <nav>
          {links.map(([path, label, Icon]) => (
            <NavLink key={path} to={`/admin${path ? "/" + path : ""}`} end>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <NavLink className="admin-back" to="/">
          <ArrowLeft size={17} />
          Volver a la tienda
        </NavLink>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <span>Panel de administración</span>
          <div className="header-actions">
            <strong>
              {user.first_name} <span className="mini-tag">ADMIN</span>
            </strong>
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                setError("");
                try {
                  await logout();
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <LogOut size={17} />
              {busy ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </div>
        </header>
        <main className="admin-content">
          <ErrorBox message={error} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
