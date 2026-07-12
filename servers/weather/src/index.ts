import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { OpenMeteoClient } from "./client.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { WeatherService } from "./service.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new OpenMeteoClient(config);
  await createServer(new WeatherService(client)).connect(new StdioServerTransport());
}
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`Weather MCP startup failed: ${message}`);
  process.exit(1);
});
