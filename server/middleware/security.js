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
export function allowedOrigin(origin) {
  const expected = (process.env.APP_ORIGIN || "http://localhost:5173").replace(
    /\/+$/,
    "",
  );
  return (
    origin === expected ||
    (process.env.NODE_ENV !== "production" &&
      /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):(517[3-9]|518[0-3])$/.test(
        origin || "",
      ))
  );
}
export function cors(req, res, next) {
  const origin = req.get("origin");
  res.vary("Origin");
  if (origin && allowedOrigin(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.set(
        "Access-Control-Allow-Methods",
        "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
      );
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.sendStatus(204);
    }
  } else if (origin) {
    return res.status(403).json({ error: "Origen de solicitud no permitido." });
  }
  next();
}
export function sameOrigin(req, res, next) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    assert(
      !origin || allowedOrigin(origin),
      403,
      "Origen de solicitud no permitido.",
    );
    // Cross-site cookies are accepted only from the explicitly configured frontend.
    assert(
      req.get("sec-fetch-site") !== "cross-site" ||
        (process.env.NODE_ENV === "production" && allowedOrigin(origin)),
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
