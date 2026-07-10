import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { TrelloClient } from "./clients/trelloClient.js";
import { loadConfig } from "./config.js";
import { BoardService } from "./services/boardService.js";
import { CardService } from "./services/cardService.js";
import { WriteService } from "./services/writeService.js";
import { registerAnalysisTools } from "./tools/analysisTools.js";
import { registerBoardTools } from "./tools/boardTools.js";
import { registerCardTools } from "./tools/cardTools.js";
import { registerWriteTools } from "./tools/writeTools.js";
import { registerWorkQueueTools } from "./tools/workQueueTools.js";
import { toPublicError } from "./utils/errors.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const trelloClient = new TrelloClient({
    apiKey: config.trelloApiKey,
    token: config.trelloToken,
    baseUrl: config.trelloApiBaseUrl
  });

  const boardService = new BoardService(trelloClient, config.trelloMainBoardId);
  const cardService = new CardService(trelloClient, boardService, config.trelloMainBoardId);
  const writeService = new WriteService(
    trelloClient,
    boardService,
    cardService,
    config.trelloMainBoardId
  );

  const server = new McpServer({
    name: "trello",
    version: "0.1.0"
  });

  registerBoardTools(server, boardService);
  registerCardTools(server, cardService);
  registerWorkQueueTools(server, cardService);
  registerAnalysisTools(server, cardService);
  registerWriteTools(server, writeService);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const publicError = toPublicError(error);
  logger.error(`Startup failed: ${publicError.message}`, { code: publicError.code });
  process.exit(1);
});
