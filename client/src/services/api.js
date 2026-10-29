// An empty origin preserves Vite's local /api and /uploads proxies.
const backend = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
export const API_BASE_URL = backend.endsWith("/api")
  ? backend
  : `${backend}/api`;
const backendOrigin = backend.replace(/\/api$/, "");
export const mediaUrl = (url) =>
  url?.startsWith("/uploads/") ? `${backendOrigin}${url}` : url;

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/${path.replace(/^\/+/, "")}`, {
    credentials: "include",
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
    body:
      options.body instanceof FormData
        ? options.body
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("No pudimos conectar con el servidor.");
  }
  if (!response.ok) {
    const error = new Error(
      data.details?.length
        ? `${data.error} ${data.details.join(" · ")}`
        : data.error || "No se pudo completar la solicitud.",
    );
    error.status = response.status;
    if (response.status === 401 && !/^\/auth\/(login|register)$/.test(path))
      window.dispatchEvent(new Event("auth:session-expired"));
    throw error;
  }
  return data;
}
