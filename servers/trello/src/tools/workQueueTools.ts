import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { CardService } from "../services/cardService.js";
import { sortWorkItems, toWorkItem } from "../services/cardService.js";
import { safeTool } from "./result.js";

const getWorkQueueSchema = z.object({
  includeBacklog: z.boolean().default(true),
  includeTodo: z.boolean().default(true)
});

export function registerWorkQueueTools(server: McpServer, cardService: CardService): void {
  server.registerTool(
    "get_work_queue",
    {
      title: "Get Trello work queue",
      description:
        "Read-only. Preferred entry point for understanding available work. Returns normalized WorkItems from Back-Log and To-Do by default, sorted deterministically by overdue status, due date, and Trello card position.",
      inputSchema: getWorkQueueSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = getWorkQueueSchema.parse(input);
        const lists = [
          ...(args.includeBacklog ? ["Back-Log"] : []),
          ...(args.includeTodo ? ["To-Do"] : [])
        ];

        const cards = await cardService.getCardsFromLists(lists, {
          includeComments: false,
          includeAttachments: false
        });

        return sortWorkItems(cards.map((card) => toWorkItem(card)));
      })
  );
}
