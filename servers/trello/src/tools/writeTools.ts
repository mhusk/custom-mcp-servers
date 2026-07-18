import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { WriteService } from "../services/writeService.js";
import { safeTool } from "./result.js";

const idSchema = z.string().trim().min(1).max(50);
const boardSchema = z.string().trim().min(1).max(50).default("main");
const boardField = { board: boardSchema };

export const addCardCommentSchema = z.object({
  ...boardField,
  cardId: idSchema,
  text: z.string().trim().min(1).max(16384)
});

export const createCardChecklistSchema = z.object({
  ...boardField,
  cardId: idSchema,
  name: z.string().trim().min(1).max(500)
});

export const addChecklistItemSchema = z.object({
  ...boardField,
  cardId: idSchema,
  checklistId: idSchema,
  name: z.string().trim().min(1).max(500)
});

export const updateCardDescriptionSchema = z.object({
  ...boardField,
  cardId: idSchema,
  description: z.string().max(16384)
});

export const customFieldValueSchema = z.union([
  z.string().max(1000),
  z.number(),
  z.boolean(),
  z.null(),
  z.object({
    idValue: idSchema
  })
]);

export const updateCardCustomFieldSchema = z.object({
  ...boardField,
  cardId: idSchema,
  customFieldId: idSchema,
  value: customFieldValueSchema
});

export const addCardLabelSchema = z.object({
  ...boardField,
  cardId: idSchema,
  labelId: idSchema
});

export const removeCardLabelSchema = z.object({
  ...boardField,
  cardId: idSchema,
  labelId: idSchema
});

export const createListSchema = z.object({
  board: z.literal("staging"),
  name: z.string().trim().min(1).max(100),
  position: z.union([z.number(), z.enum(["top", "bottom"])]).optional()
});

const createCardBaseSchema = z.object({
  board: z.literal("staging"),
  listId: idSchema.optional(),
  listName: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(500),
  description: z.string().max(16384),
  due: z.string().datetime().optional(),
  labels: z.array(z.string().trim().min(1).max(50)).optional(),
  customFields: z.record(idSchema, customFieldValueSchema).optional()
});
export const createCardSchema = createCardBaseSchema.refine(
  (value) => Boolean(value.listId) !== Boolean(value.listName),
  { message: "Provide exactly one of listId or listName." }
);

export const moveCardWithinBoardSchema = z.object({
  board: boardSchema,
  cardId: idSchema,
  destinationListId: idSchema
});

export function registerWriteTools(server: McpServer, writeService: WriteService): void {
  server.registerTool(
    "create_list",
    {
      title: "Create a staging-board list",
      description:
        "Write. Explicit operator action only; scheduled jobs must never call this tool. Creates a list only on the staging board and never renames, archives, or deletes lists.",
      inputSchema: createListSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = createListSchema.parse(input);
        return writeService.createList(args.name, args.position);
      })
  );

  server.registerTool(
    "create_card",
    {
      title: "Create a staging-board card",
      description:
        "Write. Creates a card only on the staging board. Resolves the supplied list on that board and rejects missing or ambiguous lists, labels, and custom fields without fallback.",
      inputSchema: createCardBaseSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = createCardSchema.parse(input);
        return writeService.createCard(args);
      })
  );

  server.registerTool(
    "move_card_within_board",
    {
      title: "Move a Trello card within one allowed board",
      description:
        "Write. Moves a card to a destination list only after verifying the card and list belong to the same selected allowlisted board. It never moves cards across boards.",
      inputSchema: moveCardWithinBoardSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = moveCardWithinBoardSchema.parse(input);
        return writeService.moveCardWithinBoard(args.board, args.cardId, args.destinationListId);
      })
  );

  server.registerTool(
    "create_card_checklist",
    {
      title: "Create Trello card checklist",
      description:
        "Write. Creates a checklist on a card on the configured Trello board and returns the refreshed normalized card. This write is independent of comment writes; if it fails, report that the checklist was not created before posting any summary comment.",
      inputSchema: createCardChecklistSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = createCardChecklistSchema.parse(input);
        return writeService.createChecklist(args.cardId, args.name, args.board);
      })
  );

  server.registerTool(
    "add_checklist_item",
    {
      title: "Add Trello checklist item",
      description:
        "Write. Adds an item to a checklist on the specified card on the configured Trello board and returns the refreshed normalized card. This write is independent of comment writes; if it fails, report that the checklist item was not added before posting any summary comment.",
      inputSchema: addChecklistItemSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = addChecklistItemSchema.parse(input);
        return writeService.addChecklistItem(args.cardId, args.checklistId, args.name, args.board);
      })
  );

  server.registerTool(
    "add_card_comment",
    {
      title: "Add Trello card comment",
      description:
        "Write. Adds a comment to a card on the configured Trello board and returns the refreshed normalized card.",
      inputSchema: addCardCommentSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = addCardCommentSchema.parse(input);
        return writeService.addComment(args.cardId, args.text, args.board);
      })
  );

  server.registerTool(
    "update_card_description",
    {
      title: "Update Trello card description",
      description:
        "Write. Replaces a card description on the configured Trello board and returns the refreshed normalized card.",
      inputSchema: updateCardDescriptionSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = updateCardDescriptionSchema.parse(input);
        return writeService.updateDescription(args.cardId, args.description, args.board);
      })
  );

  server.registerTool(
    "update_card_custom_field",
    {
      title: "Update Trello card custom field",
      description:
        "Write. Updates or clears a custom field on a card on the configured Trello board and returns the refreshed normalized card. Use null to clear a field or { idValue } for list option fields.",
      inputSchema: updateCardCustomFieldSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = updateCardCustomFieldSchema.parse(input);
        return writeService.updateCustomField(
          args.cardId,
          args.customFieldId,
          args.value,
          args.board
        );
      })
  );

  server.registerTool(
    "add_card_label",
    {
      title: "Add Trello card label",
      description:
        "Write. Adds a label by label ID to a card on the configured Trello board and returns the refreshed normalized card.",
      inputSchema: addCardLabelSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = addCardLabelSchema.parse(input);
        return writeService.addLabel(args.cardId, args.labelId, args.board);
      })
  );

  server.registerTool(
    "remove_card_label",
    {
      title: "Remove Trello card label",
      description:
        "Write. Removes a label by label ID from a card on the configured Trello board and returns the refreshed normalized card.",
      inputSchema: removeCardLabelSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = removeCardLabelSchema.parse(input);
        return writeService.removeLabel(args.cardId, args.labelId, args.board);
      })
  );
}
