import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { BoardService } from "../services/boardService.js";
import { safeTool } from "./result.js";

export function registerBoardTools(server: McpServer, boardService: BoardService): void {
  server.registerTool(
    "get_board_overview",
    {
      title: "Get Trello board overview",
      description:
        "Read-only. Returns the configured Trello board's ID, name, URL, available lists, open-card counts, labels, and custom field definitions. Use this to orient yourself to the board structure before inspecting cards.",
      inputSchema: {}
    },
    async () => safeTool(() => boardService.getOverview())
  );
}
