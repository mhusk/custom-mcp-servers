import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { PromotionService } from "../services/promotionService.js";
import { safeTool } from "./result.js";

export const promoteStagingTaskSchema = z.object({
  stagingCardId: z.string().trim().min(1),
  destinationBoard: z.literal("main"),
  destinationListId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(200)
});

export function registerPromotionTools(server: McpServer, service: PromotionService): void {
  server.registerTool(
    "promote_staging_task",
    {
      title: "Promote an approved staging task",
      description:
        "Workflow write. Promotes only a staging card an operator placed in Ready to Transfer. Creates a sanitized new task on main, links and logs the staging source, and honors a persistent idempotency key so retries cannot duplicate the main-board card.",
      inputSchema: promoteStagingTaskSchema.shape
    },
    async (input) => safeTool(() => service.promote(promoteStagingTaskSchema.parse(input)))
  );
}
