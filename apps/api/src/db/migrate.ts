import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { loadConfig } from "../config.js";

const { Pool } = pg;
const config = loadConfig();
const pool = new Pool({ connectionString: config.databaseUrl });

async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = path.resolve(process.cwd(), "db", "migrations");
  const filenames = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();

  for (const filename of filenames) {
    const existing = await pool.query("SELECT filename FROM schema_migrations WHERE filename = $1", [filename]);
    if (existing.rowCount) {
      console.log(`skipping ${filename}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, filename), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.log(`applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

try {
  await migrate();
} finally {
  await pool.end();
}
