import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { CardService } from "../services/cardService.js";
import { safeTool } from "./result.js";

const getCardsInListBaseSchema = z.object({
  board: z.string().trim().min(1).max(50).default("main"),
  listId: z.string().trim().min(1).max(50).optional(),
  listName: z.string().trim().min(1).max(100).optional(),
  includeComments: z.boolean().default(false),
  includeAttachments: z.boolean().default(true)
});

const getCardsInListSchema = getCardsInListBaseSchema.refine(
  (value) => Boolean(value.listId) !== Boolean(value.listName),
  {
    message: "Provide exactly one of listId or listName."
  }
);

const getCardDetailsSchema = z.object({
  board: z.string().trim().min(1).max(50).default("main"),
  cardId: z.string().trim().min(1).max(50),
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
      inputSchema: getCardsInListBaseSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = getCardsInListSchema.parse(input);
        return cardService.getCardsInList(
          { listId: args.listId, listName: args.listName },
          args,
          args.board
        );
      })
  );

  server.registerTool(
    "get_card_details",
    {
      title: "Get Trello card details",
      description:
        "Read-only. Returns a normalized card only after validating it belongs to the selected allowlisted board. The board defaults to main; arbitrary cards from other boards are rejected.",
      inputSchema: getCardDetailsSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = getCardDetailsSchema.parse(input);
        return cardService.getCardDetails(args.cardId, args, args.board);
      })
  );
}
