import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  UserRound,
  Menu,
  X,
  ArrowUpRight,
  Search,
  Box,
  ShieldCheck,
  PackageCheck,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
const currentYear = new Date().getFullYear();
export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Doble A, inicio">
      <img
        className="brand-logo"
        src="/img/doblea.png"
        alt=""
        width="64"
        height="64"
      />
      <span>
        NOVEDADES
        <br />
        DOBLE A
      </span>
    </Link>
  );
}
export default function StoreLayout() {
  const { user, cartCount } = useAuth();
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  return (
    <>
      <div className="topbar">
        <span>Pequeñas cosas. Grandes posibilidades.</span>
        <span>
          VENTA MAYORISTA Y MINORISTA <ArrowUpRight size={13} />
        </span>
      </div>
      <header className="header">
        <div className="header-main wrap">
          <Logo />
          <form
            className="header-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(
                `/productos?search=${encodeURIComponent(new FormData(e.currentTarget).get("search"))}`,
              );
            }}
          >
            <Search size={18} />
            <input
              name="search"
              aria-label="Buscar productos"
              placeholder="¿Qué estás buscando?"
            />
            <kbd>Buscar</kbd>
          </form>
          <div className="header-actions">
            <Link
              className="account-link"
              aria-label={user ? "Mi perfil" : "Iniciar sesión o registrarme"}
              to={user ? "/perfil" : "/login"}
            >
              <UserRound size={21} />
              <span>
                {user ? `Hola, ${user.first_name}` : "Mi cuenta"}
                <small>
                  {user ? "Ver mi perfil" : "Ingresar / Registrarme"}
                </small>
              </span>
            </Link>
            <Link
              className="cart-link"
              to="/carrito"
              aria-label={`Carrito, ${cartCount} productos`}
            >
              <ShoppingBag size={23} />
              <span>{cartCount}</span>
            </Link>
            <button
              className="mobile-toggle icon-button"
              aria-label={menu ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        <div className={`nav-row ${menu ? "open" : ""}`}>
          <nav
            className="wrap"
            aria-label="Navegación principal"
            onClick={() => setMenu(false)}
          >
            <div>
              <NavLink to="/" end>
                Inicio
              </NavLink>
              <NavLink to="/productos">Productos</NavLink>
              <NavLink to="/categorias">Categorías</NavLink>
              <NavLink to="/impresiones-3d">
                <Box size={16} /> Impresiones 3D{" "}
                <span className="mini-tag">A TU MEDIDA</span>
              </NavLink>
            </div>
            {user?.role === "ADMIN" ? (
              <NavLink to="/admin">
                Panel de administración <ArrowUpRight size={15} />
              </NavLink>
            ) : (
              <Link to="/#negocio">
                Conocé Doble A <ArrowUpRight size={15} />
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <section className="service-strip wrap">
        <div>
          <PackageCheck />
          <span>
            <strong>Para vos y tu negocio</strong>
            <small>Ventas por unidad y por mayor</small>
          </span>
        </div>
        <div>
          <ShieldCheck />
          <span>
            <strong>Atención de persona a persona</strong>
            <small>Te acompañamos en tu compra</small>
          </span>
        </div>
        <div>
          <Box />
          <span>
            <strong>Ideas que toman forma</strong>
            <small>Impresiones 3D personalizadas</small>
          </span>
        </div>
      </section>
      <footer>
        <div className="wrap footer-top">
          <Logo />
          <p>
            Tecnología para todos los días.
            <br />
            Ideas para hacerlas realidad.
          </p>
          <div>
            <Link to="/productos">Explorar productos</Link>
            <Link to="/impresiones-3d">Impresiones 3D</Link>
            <Link to="/perfil">Mi cuenta y pedidos</Link>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>© {currentYear} Novedades Doble A</span>
          <span>Mayorista · Minorista · Impresión 3D</span>
        </div>
      </footer>
    </>
  );
}
