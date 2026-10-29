import { useEffect, useRef, useState } from "react";
import { api, API_BASE_URL } from "../services/api";
import { money, date } from "../utils/format";
import { ErrorBox } from "./UI";
import { PaymentBadge, PaymentSummary, ReceiptUpload } from "./Payments";

export default function OrderPayment({ order, admin, refresh }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState(null),
    [uploadBusy, setUploadBusy] = useState(false),
    [modal, setModal] = useState(null),
    [reason, setReason] = useState("");
  const [maxBytes, setMaxBytes] = useState(5242880),
    [viewer, setViewer] = useState(null);
  const dialogRef = useRef(null),
    actionLock = useRef(false);
  useEffect(() => {
    api("/payment-settings")
      .then((s) => setMaxBytes(s.receipt_max_bytes))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (modal) dialogRef.current?.showModal();
  }, [modal]);
  useEffect(
    () => () => {
      if (viewer) URL.revokeObjectURL(viewer.url);
    },
    [viewer],
  );
  const pending = order.receipts?.find(
    (r) => r.verification_status === "PENDING_VERIFICATION",
  );
  async function action(callback, shouldRefresh = true) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      await callback();
      if (shouldRefresh) refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function openReceipt(r, download = false) {
    await action(async () => {
      const response = await fetch(`${API_BASE_URL}/payment-receipts/${r.id}`, {
        credentials: "include",
      });
      if (!response.ok)
        throw new Error(
          "No pudimos abrir el comprobante. Actualizá la sesión e intentá nuevamente.",
        );
      const url = URL.createObjectURL(await response.blob());
      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = r.original_filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else setViewer({ url, mime: r.mime_type, name: r.original_filename });
    }, false);
  }
  return (
    <section className="panel payment-section">
      <h2>Pago del pedido</h2>
      <PaymentBadge status={order.payment_status} />
      <PaymentSummary order={order} />
      {order.payment_status === "PENDING_VERIFICATION" && (
        <p role="status">Estamos verificando tu transferencia.</p>
      )}
      {order.payment_method === "EFECTIVO" &&
        order.payment_status === "PENDING_PAYMENT" && (
          <p>El pago se encuentra pendiente de confirmación.</p>
        )}
      {order.payment_approved_at && (
        <p>
          Pago confirmado: {date(order.payment_approved_at)} · Administrador #
          {order.payment_approved_by}
        </p>
      )}
      {!!order.receipts?.length && (
        <>
          <h3>Comprobantes de pago</h3>
          {order.receipts.map((r) => (
            <article key={r.id} className="receipt-history">
              <strong>{r.original_filename}</strong>
              <small>{date(r.uploaded_at)}</small>
              <PaymentBadge status={r.verification_status} />
              {r.rejection_reason && (
                <p className="danger">
                  Motivo del rechazo: {r.rejection_reason}
                </p>
              )}
              <div className="button-row">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => openReceipt(r)}
                >
                  {r.mime_type === "application/pdf"
                    ? "Abrir PDF"
                    : "Ver y ampliar comprobante"}
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => openReceipt(r, true)}
                >
                  Descargar comprobante
                </button>
              </div>
            </article>
          ))}
        </>
      )}
      {viewer && (
        <div className="receipt-viewer">
          <div className="button-row">
            <strong>{viewer.name}</strong>
            <button
              className="button secondary"
              onClick={() => setViewer(null)}
            >
              Cerrar vista previa
            </button>
          </div>
          {viewer.mime === "application/pdf" ? (
            <iframe title="Comprobante de transferencia PDF" src={viewer.url} />
          ) : (
            <a href={viewer.url} target="_blank" rel="noreferrer">
              <img
                src={viewer.url}
                alt="Comprobante de transferencia ampliado"
              />
            </a>
          )}
        </div>
      )}
      {!admin &&
        order.payment_status === "REJECTED" &&
        order.status !== "CANCELADO" && (
          <>
            <ReceiptUpload
              value={receipt}
              onChange={setReceipt}
              disabled={busy}
              onBusy={setUploadBusy}
              maxBytes={maxBytes}
            />
            <button
              className="button primary"
              disabled={busy || uploadBusy || !receipt}
              onClick={() =>
                action(async () => {
                  await api(`/orders/${order.id}/receipts`, {
                    method: "POST",
                    body: { receipt_id: receipt.id },
                  });
                  setReceipt(null);
                })
              }
            >
              Subir nuevo comprobante
            </button>
          </>
        )}
      {admin &&
        order.status !== "CANCELADO" &&
        ["PENDING_PAYMENT", "PENDING_VERIFICATION"].includes(
          order.payment_status,
        ) && (
          <>
            <p className="hint">
              Antes de aprobar una transferencia, comprobá el ingreso real de
              los fondos. El comprobante por sí solo no confirma el pago.
            </p>
            <div className="button-row">
              <button
                className="button primary"
                disabled={busy}
                onClick={() => {
                  setReason("");
                  setModal("APPROVED");
                }}
              >
                {order.payment_method === "EFECTIVO"
                  ? "Confirmar pago recibido"
                  : "Aprobar pago"}
              </button>
              {pending && (
                <button
                  className="button secondary danger"
                  disabled={busy}
                  onClick={() => {
                    setReason("");
                    setModal("REJECTED");
                  }}
                >
                  Rechazar comprobante
                </button>
              )}
            </div>
          </>
        )}
      {modal && (
        <dialog
          ref={dialogRef}
          className="payment-dialog"
          aria-labelledby="payment-dialog-title"
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setModal(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action(async () => {
                await api(`/admin/orders/${order.id}/payment`, {
                  method: "PATCH",
                  body: {
                    status: modal,
                    expected_status: order.payment_status,
                    ...(pending ? { receipt_id: pending.id } : {}),
                    ...(modal === "REJECTED" ? { reason } : {}),
                  },
                });
                setModal(null);
              });
            }}
          >
            <h2 id="payment-dialog-title">
              {modal === "APPROVED"
                ? "¿Confirmás que recibiste el pago?"
                : "Rechazar comprobante"}
            </h2>
            <p>
              Pedido #{order.id} · {money(order.total)}
            </p>
            {modal === "REJECTED" && (
              <label>
                Motivo del rechazo
                <textarea
                  required
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            <ErrorBox message={error} />
            <div className="button-row">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={busy || (modal === "REJECTED" && !reason.trim())}
              >
                {busy ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </form>
        </dialog>
      )}
      <ErrorBox message={error} />
      {admin && !!order.payment_history?.length && (
        <details>
          <summary>Historial de auditoría</summary>
          <ul>
            {order.payment_history.map((h) => (
              <li key={h.id}>
                {date(h.created_at)} · {h.first_name} {h.last_name} ·{" "}
                {{
                  ORDER_CREATED: "Pedido registrado",
                  PAYMENT_APPROVED: "Pago aprobado",
                  PAYMENT_REJECTED: "Comprobante rechazado",
                  RECEIPT_RESUBMITTED: "Nuevo comprobante",
                  ORDER_STATUS_CHANGED: "Estado del pedido actualizado",
                }[h.action] || h.action}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
