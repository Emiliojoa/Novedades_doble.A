import { readFile } from "node:fs/promises";
import { rawSql, closeDatabase } from "../config/database.js";
try {
  await rawSql(
    await readFile(
      new URL("../migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log(
    "Esquema store creado en PostgreSQL/Supabase. No se cargaron datos ficticios.",
  );
} catch (error) {
  console.error("No se pudo ejecutar la migración:", error.code || error.name);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
