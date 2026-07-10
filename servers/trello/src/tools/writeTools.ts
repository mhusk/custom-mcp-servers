import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { WriteService } from "../services/writeService.js";
import { safeTool } from "./result.js";

const idSchema = z.string().trim().min(1);

export const addCardCommentSchema = z.object({
  cardId: idSchema,
  text: z.string().trim().min(1)
});

export const createCardChecklistSchema = z.object({
  cardId: idSchema,
  name: z.string().trim().min(1)
});

export const addChecklistItemSchema = z.object({
  cardId: idSchema,
  checklistId: idSchema,
  name: z.string().trim().min(1)
});

export const updateCardDescriptionSchema = z.object({
  cardId: idSchema,
  description: z.string()
});

export const customFieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.object({
    idValue: idSchema
  })
]);

export const updateCardCustomFieldSchema = z.object({
  cardId: idSchema,
  customFieldId: idSchema,
  value: customFieldValueSchema
});

export const addCardLabelSchema = z.object({
  cardId: idSchema,
  labelId: idSchema
});

export const removeCardLabelSchema = z.object({
  cardId: idSchema,
  labelId: idSchema
});

export function registerWriteTools(server: McpServer, writeService: WriteService): void {
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
        return writeService.createChecklist(args.cardId, args.name);
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
        return writeService.addChecklistItem(args.cardId, args.checklistId, args.name);
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
        return writeService.addComment(args.cardId, args.text);
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
        return writeService.updateDescription(args.cardId, args.description);
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
        return writeService.updateCustomField(args.cardId, args.customFieldId, args.value);
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
        return writeService.addLabel(args.cardId, args.labelId);
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
        return writeService.removeLabel(args.cardId, args.labelId);
      })
  );
}
