export interface ApiConfig {
  runtimeEnv: string;
  port: number;
  host: string;
  corsOrigin: string;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  requireAuth: boolean;
  storeDriver: "in-memory" | "postgres";
}

const DEFAULT_DATABASE_URL = "postgres://runmate:runmate@localhost:5432/runmate";
const DEVELOPMENT_ACCESS_SECRET = "dev-access-secret";
const DEVELOPMENT_REFRESH_SECRET = "dev-refresh-secret";

export function loadConfig(): ApiConfig {
  const storeDriver = process.env.STORE_DRIVER === "postgres" ? "postgres" : "in-memory";

  return {
    runtimeEnv: process.env.RUNMATE_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "development"),
    port: Number(process.env.API_PORT ?? process.env.PORT ?? 4000),
    host: process.env.API_HOST ?? "0.0.0.0",
    corsOrigin: process.env.CORS_ORIGIN ?? "*",
    databaseUrl: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? DEVELOPMENT_ACCESS_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? DEVELOPMENT_REFRESH_SECRET,
    requireAuth: process.env.REQUIRE_AUTH === "true",
    storeDriver,
  };
}

export function assertDeploySafeConfig(config: ApiConfig): void {
  if (config.runtimeEnv !== "preview" && config.runtimeEnv !== "production") {
    return;
  }

  const problems: string[] = [];
  if (config.storeDriver !== "postgres") {
    problems.push("STORE_DRIVER must be postgres for preview/production.");
  }
  if (!config.requireAuth) {
    problems.push("REQUIRE_AUTH must be true for preview/production.");
  }
  if (config.jwtAccessSecret === DEVELOPMENT_ACCESS_SECRET || config.jwtAccessSecret === "replace-me") {
    problems.push("JWT_ACCESS_SECRET must be replaced.");
  }
  if (config.jwtRefreshSecret === DEVELOPMENT_REFRESH_SECRET || config.jwtRefreshSecret === "replace-me") {
    problems.push("JWT_REFRESH_SECRET must be replaced.");
  }
  if (config.jwtAccessSecret === config.jwtRefreshSecret) {
    problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.");
  }
  if (config.databaseUrl === DEFAULT_DATABASE_URL || isLocalDatabaseUrl(config.databaseUrl)) {
    problems.push("DATABASE_URL must point to the deployed PostgreSQL database, not localhost.");
  }

  if (problems.length) {
    throw new Error(`Unsafe ${config.runtimeEnv} API configuration:\n- ${problems.join("\n- ")}`);
  }
}

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    const host = new URL(databaseUrl).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return true;
  }
}
