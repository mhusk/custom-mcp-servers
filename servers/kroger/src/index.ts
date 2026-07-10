import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { KrogerClient } from "./clients/krogerClient.js";
import { loadConfig } from "./config.js";
import { KrogerService } from "./services/krogerService.js";
import { registerCartTools } from "./tools/cartTools.js";
import { registerLocationTools } from "./tools/locationTools.js";
import { registerProductTools } from "./tools/productTools.js";
import { toPublicError } from "./utils/errors.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new KrogerClient({
    accessToken: config.krogerAccessToken,
    baseUrl: config.krogerApiBaseUrl
  });
  const service = new KrogerService(client, config.krogerDefaultLocationId);
  const server = new McpServer({ name: "kroger", version: "0.1.0" });

  registerLocationTools(server, service);
  registerProductTools(server, service);
  registerCartTools(server, service);

  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  const publicError = toPublicError(error);
  logger.error(`Startup failed: ${publicError.message}`, { code: publicError.code });
  process.exit(1);
});
