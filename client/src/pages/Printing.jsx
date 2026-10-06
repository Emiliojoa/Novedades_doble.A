import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  ArrowUpRight,
  Layers3,
  Lightbulb,
  Check,
  ImagePlus,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { ErrorBox } from "../components/UI";
export default function Printing() {
  const { user } = useAuth();
  const imageInput = useRef(null);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [imageError, setImageError] = useState("");
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  function selectImage(e) {
    const file = e.target.files[0];
    setImageError("");
    setSent(false);
    if (
      file &&
      (!["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024)
    ) {
      setImageError("Elegí una imagen JPG, PNG o WebP de hasta 5 MB.");
      e.target.value = "";
      setImage(null);
      setPreview("");
      return;
    }
    setImage(file || null);
    setPreview(file ? URL.createObjectURL(file) : "");
  }
  const [error, setError] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (busy || imageError) {
      imageInput.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    setSent(false);
    const data = new FormData(form);
    if (!image) data.delete("image");
    try {
      await api("/quotes", { method: "POST", body: data });
      setSent(true);
      form.reset();
      setImage(null);
      setPreview("");
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
          <form className="panel quote-form" onSubmit={submit} aria-busy={busy}>
            <ErrorBox message={error} />
            {sent && (
              <div className="success" role="status">
                <Check size={18} />
                Solicitud enviada. Podés verla en{" "}
                <Link to="/perfil">tu perfil</Link>.
              </div>
            )}
            <label>
              Nombre del diseño
              <input
                name="name"
                required
                maxLength={120}
                placeholder="Ej.: organizador para mi escritorio"
              />
            </label>
            <div className="quote-image-field">
              <label htmlFor="quote-image">
                Imagen de referencia{" "}
                <span className="quote-optional">(opcional)</span>
              </label>
              <p id="quote-image-help" className="quote-hint">
                Subí una foto, un dibujo o una captura de tu idea. JPG, PNG o
                WebP, hasta 5 MB.
              </p>
              <div className="quote-upload">
                <ImagePlus size={24} aria-hidden="true" />
                <input
                  ref={imageInput}
                  id="quote-image"
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={selectImage}
                  disabled={busy}
                  aria-invalid={Boolean(imageError)}
                  aria-describedby={
                    imageError ? "quote-image-error" : "quote-image-help"
                  }
                />
              </div>
              {imageError && (
                <p
                  id="quote-image-error"
                  role="alert"
                  className="quote-image-error"
                >
                  {imageError}
                </p>
              )}
              {preview && (
                <div className="quote-preview">
                  <img
                    src={preview}
                    alt="Vista previa de tu imagen de referencia"
                  />
                  <span>{image.name}</span>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      setImage(null);
                      setPreview("");
                      setImageError("");
                      imageInput.current.value = "";
                    }}
                  >
                    <X size={16} aria-hidden="true" /> Quitar imagen
                  </button>
                </div>
              )}
            </div>
            <fieldset className="quote-measurements">
              <legend>Medidas del diseño</legend>
              <p className="quote-hint" id="quote-measure-help">
                Ingresá las medidas aproximadas en centímetros. Podés usar
                decimales.
              </p>
              <div className="quote-dimensions">
                {[
                  ["width", "Ancho"],
                  ["height", "Alto"],
                  ["depth", "Profundidad"],
                ].map(([name, label]) => (
                  <label key={name}>
                    {label}
                    <span className="quote-number-unit">
                      <input
                        aria-label={`${label} en centímetros`}
                        aria-describedby="quote-measure-help"
                        name={name}
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        max="10000"
                        step="0.01"
                        placeholder="Ej.: 10"
                        required
                      />
                      <span aria-hidden="true">cm</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="quote-quantity">
              Cantidad de unidades
              <input
                name="quantity"
                type="number"
                inputMode="numeric"
                min="1"
                max="10000"
                step="1"
                defaultValue="1"
                required
              />
            </label>
            <label>
              ¿Qué te gustaría crear?
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={5000}
                rows={4}
                placeholder="Contanos para qué lo vas a usar y qué colores o detalles te gustaría incluir."
              />
            </label>
            <label>
              Tu WhatsApp
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                defaultValue={user.phone || ""}
                required
                maxLength={40}
                pattern={"(?:\\+|00)[1-9][0-9\\s\\(\\)\\-]{7,30}"}
                placeholder="+54 9 11 1234 5678"
                aria-describedby="quote-phone-help"
              />
              <small id="quote-phone-help">
                Incluí el código de país. Lo usaremos para conversar sobre tu
                impresión 3D y actualizar el teléfono de tu cuenta.
              </small>
            </label>
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
