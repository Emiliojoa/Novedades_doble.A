import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { store, publicUser } from "../repositories/store.js";
import { assert } from "../utils/errors.js";
const scrypt = promisify(scryptCb);
export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`;
}
async function verify(password, hash) {
  const [salt, key] = hash.split(":");
  return timingSafeEqual(
    await scrypt(password, salt, 64),
    Buffer.from(key, "hex"),
  );
}
export async function register(data) {
  assert(
    !(await store.one("SELECT id FROM users WHERE email=?", data.email)),
    409,
    "Ya existe una cuenta con este email.",
  );
  const hash = await hashPassword(data.password);
  try {
    const r = await store.run(
      "INSERT INTO users(first_name,last_name,email,phone,password_hash) VALUES(?,?,?,?,?)",
      data.first_name,
      data.last_name,
      data.email,
      data.phone,
      hash,
    );
    return publicUser(
      await store.one(
        "SELECT * FROM users WHERE id=?",
        Number(r.lastInsertRowid),
      ),
    );
  } catch (error) {
    if (error.code === "23505" || error.message.includes("UNIQUE"))
      assert(false, 409, "Ya existe una cuenta con este email.");
    throw error;
  }
}
export async function login(data) {
  const user = await store.one("SELECT * FROM users WHERE email=?", data.email);
  // A dummy derivation also runs for unknown accounts.
  const valid = await verify(
    data.password,
    user?.password_hash || `${"0".repeat(32)}:${"0".repeat(128)}`,
  );
  assert(user && valid, 401, "Email o contraseña incorrectos.");
  return publicUser(user);
}
export async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  await store.run("DELETE FROM sessions WHERE expires_at < ?", Date.now());
  await store.run(
    "INSERT INTO sessions VALUES(?,?,?)",
    tokenHash(token),
    userId,
    Date.now() + SESSION_MS,
  );
  return token;
}
export async function sessionUser(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return publicUser(
    await store.one(
      "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
      tokenHash(token),
      Date.now(),
    ),
  );
}
export async function logout(token) {
  if (token)
    await store.run(
      "DELETE FROM sessions WHERE token_hash=?",
      tokenHash(token),
    );
}
