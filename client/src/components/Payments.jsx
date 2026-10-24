import { useEffect, useRef, useState } from "react";
import {
  Banknote,
  Landmark,
  Copy,
  UploadCloud,
  X,
  FileText,
} from "lucide-react";
import { api } from "../services/api";
import {
  paymentAmounts,
  paymentLabels,
  methodLabels,
} from "../../../shared/payments";
import { money } from "../utils/format";
import { ErrorBox } from "./UI";

export function PaymentBadge({ status }) {
  return (
    <span className={`payment-badge payment-${status || "legacy"}`}>
      {paymentLabels[status] || "Sin pago registrado (histórico)"}
    </span>
  );
}
export function ReceiptUpload({
  value,
  onChange,
  maxBytes = 5242880,
  disabled = false,
  onBusy = () => {},
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState("");
  const input = useRef(null),
    lock = useRef(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function select(file) {
    if (!file || disabled || lock.current) return;
    setError("");
    if (
      !/\.(jpe?g|png|pdf)$/i.test(file.name) ||
      !["image/jpeg", "image/png", "application/pdf"].includes(file.type)
    ) {
      setError("Seleccioná un comprobante JPG, PNG o PDF.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`El archivo no puede superar ${maxBytes / 1048576} MB.`);
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const body = new FormData();
      body.append("receipt", file);
      const uploaded = await api("/payment-receipts", { method: "POST", body });
      if (value)
        await api(`/payment-receipts/${value.id}`, { method: "DELETE" }).catch(
          () => {},
        );
      setPreview(
        file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      );
      onChange(uploaded);
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function remove() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      await api(`/payment-receipts/${value.id}`, { method: "DELETE" });
      onChange(null);
      setPreview("");
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="receipt-upload" aria-busy={busy}>
      <h3>Adjuntar comprobante de transferencia</h3>
      <div
        className="receipt-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          select(e.dataTransfer.files[0]);
        }}
      >
        <UploadCloud size={28} aria-hidden="true" />
        <p>Arrastrá el archivo o seleccionalo desde tu dispositivo.</p>
        <label className="button secondary receipt-input">
          {value ? "Reemplazar archivo" : "Seleccionar comprobante"}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
            disabled={disabled || busy}
            onChange={(e) => select(e.target.files[0])}
          />
        </label>
        <small>
          JPG, PNG o PDF · Máximo {maxBytes / 1048576} MB. Solo vos y
          administración podrán verlo.
        </small>
      </div>
      {busy && <p role="status">Subiendo o actualizando comprobante…</p>}
      {value && (
        <div className="receipt-selected">
          {preview ? (
            <a href={preview} target="_blank" rel="noreferrer">
              <img
                src={preview}
                alt="Vista previa del comprobante seleccionado"
              />
            </a>
          ) : (
            <FileText aria-hidden="true" />
          )}
          <span>{value.original_filename}</span>
          <button
            className="icon-button danger"
            aria-label="Eliminar comprobante"
            disabled={disabled || busy}
            onClick={remove}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <ErrorBox message={error} />
    </section>
  );
}
export function PaymentSelector({
  config,
  subtotal,
  method,
  setMethod,
  receipt,
  setReceipt,
  disabled,
  onUploadBusy,
}) {
  const [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState("");
  const cash = paymentAmounts(subtotal, config.cash_discount_percentage);
  return (
    <section className="payment-section">
      <fieldset disabled={disabled}>
        <legend>Seleccioná tu método de pago</legend>
        <div className="payment-options">
          {[
            ["EFECTIVO", Banknote, "Pago en efectivo", cash.total],
            ["TRANSFERENCIA", Landmark, "Transferencia bancaria", subtotal],
          ].map(([value, Icon, title, total]) => (
            <label
              key={value}
              className={`payment-option ${method === value ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="payment-method"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
              />
              <Icon size={24} aria-hidden="true" />
              <span>
                <strong>{title}</strong>
                <small>
                  {value === "EFECTIVO"
                    ? `${config.cash_discount_percentage}% de descuento · Ahorrás ${money(cash.discount_amount)}`
                    : "Adjuntá tu comprobante para verificar el pago"}
                </small>
              </span>
              <strong>{money(total)}</strong>
            </label>
          ))}
        </div>
      </fieldset>
      {method === "TRANSFERENCIA" && (
        <>
          <div className="bank-details">
            <h3>Transferencia bancaria</h3>
            <small>Alias para transferir</small>
            <div className="bank-alias">
              <strong>{config.bank_alias}</strong>
              <button
                className="button secondary"
                disabled={disabled}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(config.bank_alias);
                    setCopied(true);
                    setCopyError("");
                  } catch {
                    setCopyError(
                      "No pudimos copiarlo. Seleccioná el alias y copialo manualmente.",
                    );
                  }
                }}
              >
                <Copy size={16} />
                {copied ? "Copiado" : "Copiar alias"}
              </button>
            </div>
            <p>
              Importe exacto: <strong>{money(subtotal)}</strong>
            </p>
            <p>
              Realizá la transferencia al alias indicado por el importe total de
              tu compra. Una vez realizada, subí el comprobante de pago para que
              podamos verificarlo y confirmar tu pedido.
            </p>
            <ErrorBox message={copyError} />
          </div>
          <ReceiptUpload
            value={receipt}
            onChange={setReceipt}
            maxBytes={config.receipt_max_bytes}
            disabled={disabled}
            onBusy={onUploadBusy}
          />
        </>
      )}
    </section>
  );
}
export function PaymentSummary({ order }) {
  return (
    <dl className="payment-totals">
      <div>
        <dt>Método de pago</dt>
        <dd>
          {methodLabels[order.payment_method] ||
            (order.id ? "Sin registrar (pedido histórico)" : "Seleccioná un método")}
        </dd>
      </div>
      <div>
        <dt>Subtotal</dt>
        <dd>{money(order.subtotal ?? order.total)}</dd>
      </div>
      <div>
        <dt>Descuento ({order.discount_percentage || 0}%)</dt>
        <dd>−{money(order.discount_amount)}</dd>
      </div>
      <div className="summary-total">
        <dt>
          {order.payment_status === "APPROVED"
            ? "Total abonado"
            : "Total a pagar"}
        </dt>
        <dd>
          <strong>{money(order.total)}</strong>
        </dd>
      </div>
      {order.payment_alias_snapshot && (
        <div>
          <dt>Alias de esta compra</dt>
          <dd>{order.payment_alias_snapshot}</dd>
        </div>
      )}
    </dl>
  );
}
