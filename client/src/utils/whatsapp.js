import { internationalPhone } from "../../../shared/phone.js";

export function quoteWhatsAppLink(quote) {
  const phone = internationalPhone(quote.phone);
  if (!phone) return "";
  const message = `Hola ${quote.first_name}, te escribimos de Novedades Doble A por tu solicitud #${quote.id}: "${quote.name}". Queríamos conversar sobre el diseño y la impresión 3D.`;
  return `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(message)}`;
}
