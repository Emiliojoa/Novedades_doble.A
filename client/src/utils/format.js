export const money = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format((value || 0) / 100);
export const date = (value) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(
    new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`),
  );
export const statusLabel = (value) =>
  ({
    PENDIENTE: "Pendiente",
    CONFIRMADO: "Confirmado",
    EN_PREPARACION: "En preparación",
    LISTO: "Listo",
    ENTREGADO: "Entregado",
    CANCELADO: "Cancelado",
    EN_REVISION: "En revisión",
    CONTACTADO: "Contactado",
    CERRADO: "Cerrado",
  })[value] || value;
