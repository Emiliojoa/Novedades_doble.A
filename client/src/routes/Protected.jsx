import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ErrorBox, Loading } from "../components/UI";
export default function Protected({ admin = false }) {
  const { user, loading, error } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="wrap page">
        <ErrorBox message={error} />
        <button
          className="button secondary"
          onClick={() => window.location.reload()}
        >
          Reintentar conexión
        </button>
      </div>
    );
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}${location.pathname === "/carrito" ? "&reason=cart" : ""}`}
        replace
      />
    );
  if (admin && user.role !== "ADMIN") return <Navigate to="/perfil" replace />;
  return <Outlet />;
}
