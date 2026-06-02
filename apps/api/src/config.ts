export interface ApiConfig {
  port: number;
  host: string;
  corsOrigin: string;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  requireAuth: boolean;
}

export function loadConfig(): ApiConfig {
  return {
    port: Number(process.env.API_PORT ?? 4000),
    host: process.env.API_HOST ?? "0.0.0.0",
    corsOrigin: process.env.CORS_ORIGIN ?? "*",
    databaseUrl: process.env.DATABASE_URL ?? "postgres://runmate:runmate@localhost:5432/runmate",
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret",
    requireAuth: process.env.REQUIRE_AUTH === "true",
  };
}
