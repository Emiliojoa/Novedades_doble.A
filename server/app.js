import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { ZodError } from "zod";
import { api, uploadsDir } from "./routes/api.js";
import { sameOrigin } from "./middleware/security.js";

export const app = express();
app.disable("x-powered-by");
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0)
  app.set("trust proxy", trustedProxyHops);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "img-src": ["'self'", "https:", "data:"],
        "upgrade-insecure-requests":
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    strictTransportSecurity:
      process.env.NODE_ENV === "production" ? undefined : false,
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes. Intentá en un minuto." },
  }),
  sameOrigin,
  api,
);
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint no encontrado." }),
);
app.use(
  "/uploads",
  express.static(uploadsDir, {
    dotfiles: "deny",
    immutable: true,
    maxAge: "1y",
  }),
);
const dist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../client/dist",
);
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(dist, "index.html")),
  );
}
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError)
    return res.status(400).json({
      error: "Revisá los datos ingresados.",
      details: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  if (error.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ error: "La imagen no puede superar 5 MB." });
  if (error.name === "MulterError")
    return res.status(400).json({ error: "Carga de imagen inválida." });
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error:
      status >= 500
        ? "Ocurrió un error inesperado. Intentá nuevamente."
        : error.message,
  });
});
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.env.NODE_ENV === "production" && !process.env.APP_ORIGIN)
    throw new Error("APP_ORIGIN es obligatorio en producción.");
  const port = Number(process.env.API_PORT) || 3001;
  app.listen(port, process.env.API_HOST || "127.0.0.1", () =>
    console.log(
      `API disponible en http://${process.env.API_HOST || "127.0.0.1"}:${port}`,
    ),
  );
}
