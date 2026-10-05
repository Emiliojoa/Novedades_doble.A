import { readFile, readdir } from "node:fs/promises";
import { rawSql, closeDatabase } from "../config/database.js";
try {
  const directory = new URL("../migrations/", import.meta.url);
  for (const file of (await readdir(directory))
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort()) {
    await rawSql(await readFile(new URL(file, directory), "utf8"));
  }
  console.log(
    "Esquema store creado en PostgreSQL/Supabase. No se cargaron datos ficticios.",
  );
} catch (error) {
  console.error("No se pudo ejecutar la migración:", error.code || error.name);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
