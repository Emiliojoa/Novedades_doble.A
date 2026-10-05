import { sessionUser } from "../services/auth.js";
import { assert } from "../utils/errors.js";
export async function authenticate(req, res, next) {
  req.user = await sessionUser(req.cookies.session);
  assert(req.user, 401, "Iniciá sesión para continuar.");
  next();
}
export function adminOnly(req, res, next) {
  assert(
    req.user?.role === "ADMIN",
    403,
    "Acceso exclusivo de administración.",
  );
  next();
}
export function sameOrigin(req, res, next) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    const expected = process.env.APP_ORIGIN || "http://localhost:5173";
    assert(
      !origin || origin === expected,
      403,
      "Origen de solicitud no permitido.",
    );
    assert(
      req.get("sec-fetch-site") !== "cross-site",
      403,
      "Solicitud entre sitios no permitida.",
    );
  }
  next();
}
export const validate = (schema) => (req, res, next) => {
  req.data = schema.parse(req.body);
  next();
};
