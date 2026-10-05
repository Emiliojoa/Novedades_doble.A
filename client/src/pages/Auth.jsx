import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { ErrorBox } from "../components/UI";
export default function Auth({ register = false }) {
  const { authenticate } = useAuth(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rawNext = params.get("next");
  const next =
    rawNext?.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/perfil";
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      await authenticate(register ? "register" : "login", data);
      navigate(next, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wrap auth-page">
      <div className="auth-intro">
        <span className="eyebrow blue">TU CUENTA DOBLE A</span>
        <h1>
          {register
            ? "Todo empieza con una cuenta."
            : "Qué bueno verte de nuevo."}
        </h1>
        <p>
          Guardá tus productos en el carrito, realizá pedidos y seguí cada
          compra desde un solo lugar.
        </p>
        <div className="auth-symbol">
          <LockKeyhole size={65} strokeWidth={1} />
        </div>
      </div>
      <form className="panel auth-form" onSubmit={submit}>
        <h2>{register ? "Creá tu cuenta" : "Ingresá a tu cuenta"}</h2>
        {params.get("reason") === "cart" && (
          <div className="notice">
            Para agregar productos al carrito, iniciá sesión o registrate.
          </div>
        )}
        <ErrorBox message={error} />
        {register && (
          <div className="form-grid">
            <label>
              Nombre
              <input
                name="first_name"
                required
                autoComplete="given-name"
                maxLength={120}
              />
            </label>
            <label>
              Apellido
              <input
                name="last_name"
                required
                autoComplete="family-name"
                maxLength={120}
              />
            </label>
          </div>
        )}
        <label>
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            maxLength={254}
          />
        </label>
        {register && (
          <label>
            Teléfono <span className="muted">(opcional)</span>
            <input name="phone" autoComplete="tel" maxLength={40} />
          </label>
        )}
        <label>
          Contraseña
          <input
            type="password"
            name="password"
            aria-label="Contraseña"
            aria-describedby={register ? "password-help" : undefined}
            required
            minLength={register ? 12 : 1}
            maxLength={128}
            autoComplete={register ? "new-password" : "current-password"}
          />
          {register && (
            <small id="password-help">Usá al menos 12 caracteres.</small>
          )}
        </label>
        <button className="button primary full" disabled={busy}>
          {busy ? "Un momento…" : register ? "Crear cuenta" : "Ingresar"}
          <ArrowUpRight size={18} />
        </button>
        <p className="auth-switch">
          {register ? "¿Ya tenés cuenta?" : "¿Todavía no tenés cuenta?"}{" "}
          <Link to={`${register ? "/login" : "/registro"}?${params}`}>
            {register ? "Iniciá sesión" : "Registrate"}
          </Link>
        </p>
      </form>
    </div>
  );
}
