import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Link,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import StoreLayout from "./layouts/StoreLayout";
import AdminLayout from "./layouts/AdminLayout";
import Protected from "./routes/Protected";
import Home from "./pages/Home";
import Catalog, { Categories } from "./pages/Catalog";
import Product from "./pages/Product";
import Auth from "./pages/Auth";
import Cart from "./pages/Cart";
import Account, { OrderDetail } from "./pages/Account";
import Printing from "./pages/Printing";
import {
  Dashboard,
  AdminProducts,
  AdminCategories,
  AdminStock,
  AdminOrders,
  AdminCustomers,
  AdminQuotes,
} from "./pages/Admin";
function Scroll() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const timer = setTimeout(
        () =>
          document
            .getElementById(hash.slice(1))
            ?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
      return () => clearTimeout(timer);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Scroll />
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<Home />} />
            <Route path="productos" element={<Catalog />} />
            <Route path="productos/:id" element={<Product />} />
            <Route path="categorias" element={<Categories />} />
            <Route path="impresiones-3d" element={<Printing />} />
            <Route path="login" element={<Auth key="login" />} />
            <Route path="registro" element={<Auth key="register" register />} />
            <Route element={<Protected />}>
              <Route path="carrito" element={<Cart />} />
              <Route path="perfil" element={<Account />} />
              <Route path="pedidos/:id" element={<OrderDetail />} />
            </Route>
            <Route
              path="*"
              element={
                <div className="wrap page">
                  <h1>No encontramos esta página.</h1>
                  <Link className="button primary" to="/">
                    Volver al inicio
                  </Link>
                </div>
              }
            />
          </Route>
          <Route element={<Protected admin />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="productos" element={<AdminProducts />} />
              <Route path="categorias" element={<AdminCategories />} />
              <Route path="stock" element={<AdminStock />} />
              <Route path="pedidos" element={<AdminOrders />} />
              <Route path="pedidos/:id" element={<OrderDetail admin />} />
              <Route path="clientes" element={<AdminCustomers />} />
              <Route path="solicitudes" element={<AdminQuotes />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
