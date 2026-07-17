import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { TrelloClient } from "./clients/trelloClient.js";
import { loadConfig } from "./config.js";
import { BoardService } from "./services/boardService.js";
import { BoardRegistry } from "./services/boardRegistry.js";
import { CardService } from "./services/cardService.js";
import { PromotionService } from "./services/promotionService.js";
import { FilePromotionStore } from "./services/promotionStore.js";
import { WriteService } from "./services/writeService.js";
import { registerAnalysisTools } from "./tools/analysisTools.js";
import { registerBoardTools } from "./tools/boardTools.js";
import { registerCardTools } from "./tools/cardTools.js";
import { registerWriteTools } from "./tools/writeTools.js";
import { registerPromotionTools } from "./tools/promotionTools.js";
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

  const boardRegistry = new BoardRegistry(config.boardRegistry, config.allowedBoardIds);
  const boardService = new BoardService(trelloClient, boardRegistry);
  const cardService = new CardService(trelloClient, boardService);
  const writeService = new WriteService(trelloClient, boardService, cardService);
  const promotionService = new PromotionService(
    boardService,
    cardService,
    writeService,
    new FilePromotionStore(config.promotionStorePath)
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
  registerPromotionTools(server, promotionService);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const publicError = toPublicError(error);
  logger.error(`Startup failed: ${publicError.message}`, { code: publicError.code });
  process.exit(1);
});
