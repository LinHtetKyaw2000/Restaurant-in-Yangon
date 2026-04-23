import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

async function migrate() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const schemaPath = join(currentDir, "schema.sql");
  const sql = await readFile(schemaPath, "utf8");

  await pool.query(sql);
  await pool.end();
  // eslint-disable-next-line no-console
  console.log("Database schema applied.");
}

migrate().catch(async (error) => {
  await pool.end();
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
