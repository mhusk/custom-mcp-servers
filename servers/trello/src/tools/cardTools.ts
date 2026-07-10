import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { CardService } from "../services/cardService.js";
import { safeTool } from "./result.js";

const getCardsInListSchema = z.object({
  listName: z.string().trim().min(1),
  includeComments: z.boolean().default(false),
  includeAttachments: z.boolean().default(true)
});

const getCardDetailsSchema = z.object({
  cardId: z.string().trim().min(1),
  includeComments: z.boolean().default(true),
  includeAttachments: z.boolean().default(true)
});

export function registerCardTools(server: McpServer, cardService: CardService): void {
  server.registerTool(
    "get_cards_in_list",
    {
      title: "Get cards in Trello list",
      description:
        "Read-only. Returns all open cards in one named list on the configured board using the normalized card model. Includes descriptions, due dates, labels, checklists, checklist item due dates, custom fields, and optionally comments and attachments.",
      inputSchema: getCardsInListSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = getCardsInListSchema.parse(input);
        return cardService.getCardsInList(args.listName, args);
      })
  );

  server.registerTool(
    "get_card_details",
    {
      title: "Get Trello card details",
      description:
        "Read-only. Returns the full normalized card for deeper inspection after reviewing the work queue. This tool validates that the card belongs to the configured main board and will not retrieve arbitrary cards from other Trello boards.",
      inputSchema: getCardDetailsSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = getCardDetailsSchema.parse(input);
        return cardService.getCardDetails(args.cardId, args);
      })
  );
}
