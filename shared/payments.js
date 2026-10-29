// Prices are integer cents; rounding is half-up to the nearest cent.
export function paymentAmounts(subtotal, percentage) {
  if (
    !Number.isSafeInteger(subtotal) ||
    subtotal < 0 ||
    !Number.isInteger(percentage) ||
    percentage < 0 ||
    percentage > 100
  )
    throw new Error("Importe o descuento inválido.");
  const discount = Number((BigInt(subtotal) * BigInt(percentage) + 50n) / 100n);
  return {
    subtotal,
    discount_percentage: percentage,
    discount_amount: discount,
    total: subtotal - discount,
  };
}
export const paymentLabels = {
  PENDING_PAYMENT: "Pendiente de pago",
  PENDING_VERIFICATION: "Pendiente de verificación",
  APPROVED: "Pago aprobado",
  REJECTED: "Pago rechazado",
};
export const methodLabels = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia bancaria",
};
