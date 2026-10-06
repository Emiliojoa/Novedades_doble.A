import { startTransition, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./auth";
import { api } from "../services/api";
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [cartCount, setCartCount] = useState(0),
    [error, setError] = useState("");
  async function refreshCart() {
    try {
      const cart = await api("/cart");
      setCartCount(cart.items.reduce((s, p) => s + p.quantity, 0));
    } catch {
      setCartCount(0);
    }
  }
  useEffect(() => {
    api("/auth/me")
      .then((currentUser) => {
        setUser(currentUser);
        return refreshCart();
      })
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);
  async function authenticate(mode, data) {
    const u = await api(`/auth/${mode}`, { method: "POST", body: data });
    setUser(u);
    setError("");
    await refreshCart();
    return u;
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    startTransition(() => {
      navigate("/", { replace: true });
      setUser(null);
      setCartCount(0);
    });
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        cartCount,
        refreshCart,
        authenticate,
        logout,
        updateCurrentUser: setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
