import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ErrorBox, Loading } from "../components/UI";
export default function Protected({ admin = false }) {
  const { user, loading, error, refreshSession } = useAuth();
  const location = useLocation();
  const [verification, setVerification] = useState(null);
  const key = location.key + location.pathname + location.search,
    userId = user?.id;
  useEffect(() => {
    if (loading || !userId) return;
    let current = true;
    refreshSession()
      .then(() => {
        if (current) setVerification({ key, error: "" });
      })
      .catch((e) => {
        if (current)
          setVerification({ key, error: e.status === 401 ? "" : e.message });
      });
    return () => {
      current = false;
    };
  }, [key, userId, loading, refreshSession]);
  if (loading || (user && verification?.key !== key)) return <Loading />;
  if (error || verification?.error)
    return (
      <div className="wrap page">
        <ErrorBox message={error || verification?.error} />
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
