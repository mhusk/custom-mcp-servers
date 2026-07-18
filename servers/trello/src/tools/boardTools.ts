import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { BoardService } from "../services/boardService.js";
import { safeTool } from "./result.js";
import { z } from "zod";

const boardSchema = z.string().trim().min(1).max(50).default("main");

export function registerBoardTools(server: McpServer, boardService: BoardService): void {
  server.registerTool(
    "list_allowed_boards",
    {
      title: "List allowed Trello boards",
      description:
        "Read-only. Lists only configured board aliases whose actual Trello board IDs are explicitly allowlisted. It never discovers or exposes arbitrary account boards.",
      inputSchema: {}
    },
    async () => safeTool(() => Promise.resolve(boardService.listAllowedBoards()))
  );

  server.registerTool(
    "get_board_overview",
    {
      title: "Get Trello board overview",
      description:
        "Read-only. Returns an allowed Trello board's ID, name, URL, lists, open-card counts, labels, and custom fields. The board defaults to main for backward compatibility.",
      inputSchema: { board: boardSchema }
    },
    async (input) => safeTool(() => boardService.getOverview(boardSchema.parse(input.board)))
  );
}
