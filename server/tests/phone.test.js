import test from "node:test";
import assert from "node:assert/strict";
import { internationalPhone } from "../../shared/phone.js";
import { quoteWhatsAppLink } from "../../client/src/utils/whatsapp.js";
import { quoteSchema } from "../models/schemas.js";

test("WhatsApp conserva el código de país y no adivina números locales", () => {
  assert.equal(internationalPhone("+54 (9) 11 1234-5678"), "+5491112345678");
  assert.equal(internationalPhone("0054 9 11 1234 5678"), "+5491112345678");
  assert.equal(internationalPhone("+34 612 345 678"), "+34612345678");
  for (const phone of [
    "",
    "11 1234 5678",
    "123",
    "+54 9 11 abc",
    "+00123456789",
    "+1234567890123456",
  ]) {
    assert.equal(internationalPhone(phone), "");
    assert.equal(quoteWhatsAppLink({ phone }), "");
  }
  const link = new URL(
    quoteWhatsAppLink({
      phone: "+54 9 11 1234 5678",
      first_name: "María",
      id: 3,
      name: "Diseño & piezas #1",
    }),
  );
  assert.equal(link.pathname, "/5491112345678");
  assert.ok(link.searchParams.get("text").includes("Diseño & piezas #1"));
});

test("La solicitud valida el teléfono antes de guardarlo", () => {
  const data = {
    name: "Diseño",
    description: "Un diseño para imprimir",
    quantity: 1,
    phone: "+54 9 11 1234 5678",
  };
  assert.equal(quoteSchema.parse(data).phone, "+5491112345678");
  assert.equal(
    quoteSchema.safeParse({ ...data, phone: undefined }).success,
    false,
  );
  assert.equal(
    quoteSchema.safeParse({ ...data, phone: "no es un teléfono" }).success,
    false,
  );
});
