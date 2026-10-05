import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import { readFileSync } from "node:fs";
import { rootCertificates } from "node:tls";
const context = new AsyncLocalStorage();
export const provider =
  process.env.DATABASE_PROVIDER ||
  (process.env.DATABASE_URL || process.env.SUPABASE_URL
    ? "postgres"
    : "sqlite");
let pool, sqlite;
if (provider === "postgres") {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Falta DATABASE_URL en server/.env. Las claves de la API Supabase no sustituyen la contraseña PostgreSQL. Consultá README.md.",
    );
  // Supabase requires TLS. Certificate verification stays enabled.
  const connectionUrl = new URL(process.env.DATABASE_URL);
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    connectionUrl.searchParams.delete(key);
  const ca = process.env.DATABASE_CA_PATH
    ? readFileSync(process.env.DATABASE_CA_PATH, "utf8")
    : readFileSync(new URL("./certs/supabase-ca.crt", import.meta.url), "utf8");
  pool = new pg.Pool({
    connectionString: connectionUrl.toString(),
    ssl:
      process.env.DATABASE_SSL === "false"
        ? false
        : { rejectUnauthorized: true, ca: [...rootCertificates, ca] },
    options: "-c search_path=store",
    max: 10,
    connectionTimeoutMillis: 10000,
  });
  pg.types.setTypeParser(20, (value) => Number(value));
  pg.types.setTypeParser(1700, (value) => Number(value));
  pg.types.setTypeParser(1184, (value) => new Date(value).toISOString());
  pg.types.setTypeParser(1114, (value) => new Date(`${value}Z`).toISOString());
} else if (provider === "sqlite") {
  sqlite = (await import("./sqlite.js")).db;
} else throw new Error("DATABASE_PROVIDER debe ser postgres o sqlite.");

// Queue the local adapter across awaited transactions. PostgreSQL uses a pooled
// connection scoped to the request's transaction through AsyncLocalStorage.
let tail = Promise.resolve();
async function localExclusive(fn) {
  if (context.getStore()) return fn();
  let release;
  const previous = tail;
  tail = new Promise((r) => {
    release = r;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}
function pgSql(sql) {
  let index = 0;
  return sql
    .replace(/\?/g, () => `$${++index}`)
    .replace(/IS NOT (\$\d+)/g, "IS DISTINCT FROM $1");
}
export async function query(sql, args = [], mode = "all") {
  if (pool) {
    let statement = pgSql(sql);
    const insertion =
      /^INSERT INTO (users|categories|products|orders|quote_requests)\b/i.test(
        statement,
      );
    if (mode === "run" && insertion) statement += " RETURNING id";
    const result = await (context.getStore()?.client || pool).query(
      statement,
      args,
    );
    return mode === "run"
      ? { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id }
      : mode === "one"
        ? result.rows[0]
        : result.rows;
  }
  return localExclusive(() => {
    const statement = sqlite.prepare(sql);
    return mode === "run"
      ? statement.run(...args)
      : mode === "one"
        ? statement.get(...args)
        : statement.all(...args);
  });
}
export async function transaction(fn) {
  if (context.getStore()) return fn();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(73120491)");
      const result = await context.run({ client }, fn);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  return localExclusive(async () => {
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const result = await context.run({ sqlite: true }, fn);
      sqlite.exec("COMMIT");
      return result;
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  });
}
export async function closeDatabase() {
  if (pool) await pool.end();
  else sqlite.close();
}
export async function rawSql(sql) {
  if (!pool) throw new Error("Este comando requiere PostgreSQL.");
  return pool.query(sql);
}
