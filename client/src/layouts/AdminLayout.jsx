import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Tags,
  ClipboardList,
  Users,
  Box,
  ArrowLeft,
} from "lucide-react";
import { Logo } from "./StoreLayout";
import { useAuth } from "../hooks/useAuth";
const links = [
  ["", "Resumen", LayoutDashboard],
  ["productos", "Productos", Package],
  ["stock", "Stock", Boxes],
  ["categorias", "Categorías", Tags],
  ["pedidos", "Pedidos", ClipboardList],
  ["clientes", "Clientes", Users],
  ["solicitudes", "Solicitudes 3D", Box],
];
export default function AdminLayout() {
  const { user } = useAuth();
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
          <strong>
            {user.first_name} <span className="mini-tag">ADMIN</span>
          </strong>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
