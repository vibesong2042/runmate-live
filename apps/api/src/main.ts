import { buildApp } from "./app.js";
import { assertDeploySafeConfig, loadConfig } from "./config.js";

const config = loadConfig();
assertDeploySafeConfig(config);
const app = await buildApp();
await app.listen({ port: config.port, host: config.host });
