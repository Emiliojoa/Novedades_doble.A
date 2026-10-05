import { useState } from "react";
import { Link } from "react-router-dom";
import { Box, ArrowUpRight, Layers3, Lightbulb, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { ErrorBox } from "../components/UI";
export default function Printing() {
  const { user } = useAuth();
  const [error, setError] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    data.quantity = Number(data.quantity);
    try {
      await api("/quotes", { method: "POST", body: data });
      setSent(true);
      form.reset();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wrap page">
      <section className="printing-hero">
        <div>
          <span className="eyebrow blue">ESTUDIO DOBLE A · IMPRESIÓN 3D</span>
          <h1>
            Tu imaginación.
            <br />
            <span>En tres dimensiones.</span>
          </h1>
          <p>
            Objetos que resuelven, regalos que sorprenden e ideas que merecen
            existir. Descubrí lo que podemos crear.
          </p>
          <Link className="button primary" to="/productos?type=IMPRESION_3D">
            Ver diseños disponibles <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="printing-icon">
          <Layers3 size={170} strokeWidth={0.8} />
          <span>DISEÑAR. IMPRIMIR. CREAR.</span>
        </div>
      </section>
      <div className="printing-options">
        <article className="panel">
          <Box className="blue" />
          <h2>Diseños listos para vos</h2>
          <p>
            Organizadores, llaveros, accesorios, decoración y más. Elegí un
            diseño del catálogo y agregalo a tu pedido.
          </p>
          <Link className="text-link" to="/productos?type=IMPRESION_3D">
            Explorar diseños <ArrowUpRight size={18} />
          </Link>
        </article>
        <article className="panel">
          <Lightbulb className="blue" />
          <h2>Algo que solo vos imaginaste</h2>
          <p>
            Contanos qué necesitás, cuántas unidades y cómo te lo imaginás.
            Revisamos tu idea y te contactamos para cotizarla.
          </p>
          <a className="text-link" href="#personalizado">
            Solicitar presupuesto <ArrowUpRight size={18} />
          </a>
        </article>
      </div>
      <section id="personalizado" className="quote-section">
        <div>
          <span className="eyebrow blue">DE LA IDEA A LA REALIDAD</span>
          <h2>Contanos tu proyecto.</h2>
          <p>
            No necesitás tener todo resuelto. Una descripción y una referencia
            nos ayudan a dar el primer paso.
          </p>
          <small>
            Esta solicitud no genera una compra ni un cobro. Te contactaremos al
            email de tu cuenta para evaluar materiales, medidas y precio.
          </small>
        </div>
        {user ? (
          <form className="panel" onSubmit={submit}>
            <ErrorBox message={error} />
            {sent && (
              <div className="success">
                <Check size={18} />
                Solicitud enviada. Podés verla en{" "}
                <Link to="/perfil">tu perfil</Link>.
              </div>
            )}
            <label>
              Nombre del diseño
              <input name="name" required maxLength={120} />
            </label>
            <label>
              ¿Qué te gustaría crear?
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={5000}
                rows={4}
                placeholder="Medidas, uso, colores y observaciones…"
              />
            </label>
            <div className="form-grid">
              <label>
                Cantidad
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  max="10000"
                  defaultValue="1"
                  required
                />
              </label>
              <label>
                Enlace de referencia (opcional)
                <input
                  name="reference"
                  type="url"
                  pattern="https://.*"
                  placeholder="https://…"
                  maxLength={2048}
                />
              </label>
            </div>
            <button className="button primary" disabled={busy}>
              {busy ? "Enviando…" : "Enviar solicitud"}
              <ArrowUpRight size={18} />
            </button>
          </form>
        ) : (
          <div className="panel">
            <h3>Guardemos tu idea en tu cuenta.</h3>
            <p>
              Ingresá o registrate para enviar una solicitud y seguir su estado.
            </p>
            <Link
              className="button primary"
              to="/login?next=%2Fimpresiones-3d%23personalizado"
            >
              Iniciar sesión <ArrowUpRight size={18} />
            </Link>
            <p>
              <Link
                className="text-link"
                to="/registro?next=%2Fimpresiones-3d%23personalizado"
              >
                Crear una cuenta
              </Link>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
