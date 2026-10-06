import { store } from "../repositories/store.js";
import { assert } from "../utils/errors.js";
export async function createQuote(userId, data) {
  return store.transaction(async () => {
    if (data.phone)
      await store.run(
        "UPDATE users SET phone=? WHERE id=?",
        data.phone,
        userId,
      );
    const id = Number(
      (
        await store.run(
          "INSERT INTO quote_requests(user_id,name,description,quantity,reference) VALUES(?,?,?,?,?)",
          userId,
          data.name,
          data.dimensions
            ? `${data.description}\n\nMedidas (cm): ancho ${data.dimensions.width} × alto ${data.dimensions.height} × profundidad ${data.dimensions.depth}.`
            : data.description,
          data.quantity,
          data.reference,
        )
      ).lastInsertRowid,
    );
    return await store.one("SELECT * FROM quote_requests WHERE id=?", id);
  });
}
export const listQuotes = async (userId) =>
  await store.all(
    `SELECT q.*,u.first_name,u.last_name,u.email,u.phone FROM quote_requests q JOIN users u ON u.id=q.user_id ${userId ? "WHERE q.user_id=?" : ""} ORDER BY q.id DESC`,
    ...(userId ? [userId] : []),
  );
export async function updateQuote(id, status) {
  assert(
    ["PENDIENTE", "EN_REVISION", "CONTACTADO", "CERRADO"].includes(status),
    400,
    "Estado inválido.",
  );
  assert(
    (
      await store.run(
        "UPDATE quote_requests SET status=? WHERE id=?",
        status,
        id,
      )
    ).changes,
    404,
    "Solicitud no encontrada.",
  );
  return await store.one("SELECT * FROM quote_requests WHERE id=?", id);
}
