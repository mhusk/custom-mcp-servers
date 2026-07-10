import { describe, expect, it } from "vitest";

import { TrelloClient } from "../../src/clients/trelloClient.js";
import { loadConfig } from "../../src/config.js";
import { BoardService } from "../../src/services/boardService.js";

const hasCredentials =
  process.env.TRELLO_API_KEY && process.env.TRELLO_TOKEN && process.env.TRELLO_MAIN_BOARD_ID;

describe.skipIf(!hasCredentials)("read-only Trello integration", () => {
  it("can read the configured board overview", async () => {
    const config = loadConfig();
    const client = new TrelloClient({
      apiKey: config.trelloApiKey,
      token: config.trelloToken,
      baseUrl: config.trelloApiBaseUrl
    });
    const service = new BoardService(client, config.trelloMainBoardId);

    const overview = await service.getOverview();

    expect(overview.id).toBe(config.trelloMainBoardId);
    expect(Array.isArray(overview.lists)).toBe(true);
  });
});
