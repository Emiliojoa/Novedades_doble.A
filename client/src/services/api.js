export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
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
    throw error;
  }
  return data;
}
