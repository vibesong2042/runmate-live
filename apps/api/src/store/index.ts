import { loadConfig } from "../config.js";
import { InMemoryStore } from "./in-memory-store.js";
import { PgStore } from "./pg-store.js";
import type { RunMateStore } from "./store-types.js";

const config = loadConfig();

export const store: RunMateStore =
  process.env.STORE_DRIVER === "postgres" ? new PgStore(config.databaseUrl) : new InMemoryStore();
