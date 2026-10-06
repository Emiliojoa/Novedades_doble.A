import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, KeyRound, Trash2, X, Search, Users } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { ErrorBox, Loading, PageHeading } from "../components/UI";
import { date } from "../utils/format";

function UserEditor({ action, onClose, onSaved, currentUserId }) {
  const dialog = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { mode, user } = action;
  const fullName = user ? `${user.first_name} ${user.last_name}` : "";
  const title = {
    create: "Crear usuario",
    edit: "Editar usuario",
    password: "Cambiar contraseña",
    delete: "Eliminar usuario",
  }[mode];
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (
      (mode === "create" || mode === "password") &&
      data.password !== data.confirmPassword
    ) {
      setError("Las contraseñas no coinciden. Revisá la confirmación.");
      form.elements.confirmPassword.focus();
      return;
    }
    delete data.confirmPassword;
    setBusy(true);
    setError("");
    try {
      const path =
        mode === "create"
          ? "/admin/users"
          : `/admin/users/${user.id}${mode === "password" ? "/password" : ""}`;
      const result = await api(path, {
        method: {
          create: "POST",
          edit: "PUT",
          password: "PATCH",
          delete: "DELETE",
        }[mode],
        ...(mode !== "delete" ? { body: data } : {}),
      });
      if (mode === "password" && user.id === currentUserId) {
        window.location.assign("/login?next=%2Fadmin%2Fusuarios");
        return;
      }
      onSaved(mode, result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="user-dialog"
      aria-labelledby="user-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="user-dialog-heading">
        <h2 id="user-dialog-title">{title}</h2>
        <button
          className="user-close"
          type="button"
          aria-label="Cerrar"
          disabled={busy}
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      {user && (
        <p className="user-dialog-identity">
          {fullName}
          <br />
          {user.email}
        </p>
      )}
      <form onSubmit={submit} aria-busy={busy}>
        <ErrorBox message={error} />
        <fieldset disabled={busy} className="user-fields">
          {(mode === "create" || mode === "edit") && (
            <>
              <div className="form-grid">
                <label>
                  Nombre
                  <input
                    name="first_name"
                    defaultValue={user?.first_name || ""}
                    required
                    maxLength={120}
                    autoComplete="given-name"
                  />
                </label>
                <label>
                  Apellido
                  <input
                    name="last_name"
                    defaultValue={user?.last_name || ""}
                    required
                    maxLength={120}
                    autoComplete="family-name"
                  />
                </label>
              </div>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={user?.email || ""}
                  required
                  maxLength={254}
                  autoComplete="off"
                />
              </label>
              <label>
                Teléfono (opcional)
                <input
                  name="phone"
                  type="tel"
                  defaultValue={user?.phone || ""}
                  maxLength={40}
                  autoComplete="tel"
                  placeholder="Ej.: +54 9 11 1234 5678"
                />
              </label>
              <p className="user-help">
                {mode === "create"
                  ? "La cuenta se creará con acceso de cliente."
                  : `Acceso: ${user.role === "ADMIN" ? "administrador" : "cliente"}.`}
              </p>
            </>
          )}
          {(mode === "create" || mode === "password") && (
            <>
              {mode === "password" && (
                <p className="user-help">
                  Se cerrarán todas las sesiones de esta cuenta.
                  {user.id === currentUserId
                    ? " Tendrás que ingresar de nuevo con la nueva contraseña."
                    : " El usuario deberá ingresar con la nueva contraseña."}
                </p>
              )}
              <label>
                {mode === "create" ? "Contraseña inicial" : "Nueva contraseña"}
                <input
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  aria-describedby="user-password-help"
                />
              </label>
              <p className="user-help" id="user-password-help">
                Usá entre 12 y 128 caracteres.
              </p>
              <label>
                Confirmar contraseña
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
            </>
          )}
          {mode === "delete" && (
            <p>
              Esta acción elimina la cuenta y su carrito. No se puede deshacer.
              Si tiene pedidos o solicitudes, conservaremos la cuenta y te
              avisaremos.
            </p>
          )}
          <div className="user-dialog-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`button ${mode === "delete" ? "user-danger" : "primary"}`}
            >
              {busy
                ? "Guardando…"
                : {
                    create: "Crear cuenta",
                    edit: "Guardar cambios",
                    password: "Actualizar contraseña",
                    delete: "Eliminar cuenta",
                  }[mode]}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}

export default function AdminUsers() {
  const { data, loading, error, refresh } = useApi("/admin/users");
  const { user: currentUser, updateCurrentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState(null);
  const [notice, setNotice] = useState("");
  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const users = (data || []).filter((user) =>
    normalize(
      `${user.first_name} ${user.last_name} ${user.email} ${user.phone}`,
    ).includes(normalize(query.trim())),
  );
  function open(mode, user) {
    setNotice("");
    setAction({ mode, user });
  }
  function saved(mode, result) {
    if (mode === "edit" && result.id === currentUser.id)
      updateCurrentUser(result);
    setAction(null);
    setNotice(
      {
        create: "Cuenta creada. Ya puede iniciar sesión.",
        edit: "Datos del usuario actualizados.",
        password:
          "Contraseña actualizada. Se cerraron las sesiones de esa cuenta.",
        delete: "Cuenta eliminada.",
      }[mode],
    );
    refresh();
  }
  return (
    <>
      <PageHeading
        title="Usuarios"
        description="Gestioná las cuentas, los datos de contacto y el acceso a la tienda."
      >
        <button className="button primary" onClick={() => open("create")}>
          <Plus size={18} /> Crear usuario
        </button>
      </PageHeading>
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <ErrorBox message={error} />
      <div className="panel user-search">
        <label htmlFor="user-search">
          <Search size={17} aria-hidden="true" /> Buscar usuario
        </label>
        <input
          id="user-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre, email o teléfono"
        />
        <small aria-live="polite">
          {loading
            ? "Cargando usuarios…"
            : `${users.length} ${users.length === 1 ? "cuenta" : "cuentas"}`}
        </small>
      </div>
      {loading ? (
        <Loading />
      ) : (
        !error && (
          <div className="user-list">
            {users.map((user) => (
              <article
                className="panel user-row"
                key={user.id}
                aria-label={`Usuario ${user.email}`}
              >
                <div className="user-identity">
                  <span className="user-avatar" aria-hidden="true">
                    <Users size={22} />
                  </span>
                  <div>
                    <h2>
                      {user.first_name} {user.last_name}
                    </h2>
                    <span className="mini-tag">
                      {user.role === "ADMIN" ? "Administrador" : "Cliente"}
                    </span>
                    {user.id === currentUser.id && (
                      <span className="user-self">Tu cuenta</span>
                    )}
                    <small>Alta: {date(user.created_at)}</small>
                  </div>
                </div>
                <div className="user-contact">
                  <a href={`mailto:${user.email}`}>{user.email}</a>
                  <span>{user.phone || "Sin teléfono registrado"}</span>
                </div>
                <div className="user-row-actions">
                  <button
                    className="button secondary"
                    onClick={() => open("edit", user)}
                  >
                    <Pencil size={16} /> Editar
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => open("password", user)}
                  >
                    <KeyRound size={16} /> Contraseña
                  </button>
                  {user.role !== "ADMIN" && (
                    <button
                      className="button user-danger"
                      onClick={() => open("delete", user)}
                    >
                      <Trash2 size={16} /> Eliminar
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!users.length && (
              <div className="panel">
                <h2>No encontramos usuarios</h2>
                <p>Probá con otro nombre, email o teléfono.</p>
                <button
                  className="button secondary"
                  onClick={() => setQuery("")}
                >
                  Limpiar búsqueda
                </button>
              </div>
            )}
          </div>
        )
      )}
      {action && (
        <UserEditor
          action={action}
          currentUserId={currentUser.id}
          onClose={() => setAction(null)}
          onSaved={saved}
        />
      )}
    </>
  );
}
