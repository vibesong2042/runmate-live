import { loadConfig } from "../config.js";
import { InMemoryStore } from "./in-memory-store.js";
import { PgStore } from "./pg-store.js";
import type { RunMateStore } from "./store-types.js";

const config = loadConfig();
const defaultStoreFile =
  process.env.RUNMATE_STORE_FILE ??
  (process.env.npm_lifecycle_event === "test" ? undefined : ".runlogs/runmate-store.json");

export const store: RunMateStore =
  config.storeDriver === "postgres" ? new PgStore(config.databaseUrl) : new InMemoryStore(defaultStoreFile);
