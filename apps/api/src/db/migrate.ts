import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { assertDeploySafeConfig, loadConfig } from "../config.js";

const { Pool } = pg;
const config = loadConfig();
assertDeploySafeConfig(config);
const pool = new Pool({ connectionString: config.databaseUrl });

async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = await findMigrationsDir();
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

async function findMigrationsDir(): Promise<string> {
  let current = path.resolve(process.cwd());

  while (true) {
    const candidate = path.join(current, "db", "migrations");
    try {
      await access(candidate);
      return candidate;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        throw new Error(`Could not find db/migrations from ${process.cwd()}`);
      }
      current = parent;
    }
  }
}

try {
  await migrate();
} finally {
  await pool.end();
}
