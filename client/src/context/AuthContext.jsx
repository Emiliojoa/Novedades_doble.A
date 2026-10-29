import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./auth";
import { api } from "../services/api";
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [cartCount, setCartCount] = useState(0),
    [error, setError] = useState("");
  const generation = useRef(0),
    pending = useRef(null);
  const clearSession = useCallback(() => {
    generation.current++;
    pending.current = null;
    setUser(null);
    setCartCount(0);
    setError("");
  }, []);
  const refreshCart = useCallback(async () => {
    const version = generation.current;
    try {
      const cart = await api("/cart");
      if (version === generation.current)
        setCartCount(cart.items.reduce((s, p) => s + p.quantity, 0));
    } catch {
      if (version === generation.current) setCartCount(0);
    }
  }, []);
  const refreshSession = useCallback(() => {
    if (pending.current) return pending.current;
    const version = generation.current;
    const request = api("/auth/me")
      .then((current) => {
        if (version === generation.current) {
          setUser(current);
          setError("");
        }
        return current;
      })
      .catch((e) => {
        if (version === generation.current) {
          if (e.status === 401) {
            setUser(null);
            setCartCount(0);
            setError("");
          } else setError(e.message);
        }
        throw e;
      })
      .finally(() => {
        if (pending.current === request) pending.current = null;
      });
    pending.current = request;
    return request;
  }, []);
  useEffect(() => {
    let active = true;
    refreshSession()
      .then(() => {
        if (active) return refreshCart();
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshSession, refreshCart]);
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === "visible")
        refreshSession().catch(() => {});
    };
    window.addEventListener("auth:session-expired", clearSession);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("auth:session-expired", clearSession);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [refreshSession, clearSession]);
  async function authenticate(mode, data) {
    const current = await api("/auth/" + mode, { method: "POST", body: data });
    generation.current++;
    pending.current = null;
    setUser(current);
    setError("");
    await refreshCart();
    return current;
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    const destination = user?.role === "ADMIN" ? "/login" : "/";
    startTransition(() => {
      clearSession();
      navigate(destination, { replace: true });
    });
  }
  const updateCurrentUser = useCallback(
    () => refreshSession().catch(() => {}),
    [refreshSession],
  );
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        cartCount,
        refreshCart,
        refreshSession,
        authenticate,
        logout,
        updateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
