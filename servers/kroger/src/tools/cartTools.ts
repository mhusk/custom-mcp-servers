import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { KrogerService } from "../services/krogerService.js";
import { safeTool } from "./result.js";

export const addToCartSchema = z.object({
  items: z
    .array(
      z.object({
        upc: z.string().trim().regex(/^\d+$/, "UPC must contain digits only.").max(20),
        quantity: z.number().int().positive(),
        modality: z.string().trim().min(1).max(50)
      })
    )
    .min(1)
});

export function registerCartTools(server: McpServer, service: KrogerService): void {
  server.registerTool(
    "add_to_cart",
    {
      title: "Add items to Kroger cart",
      description:
        "Write. Immediately adds one or more UPCs to the authenticated customer's Kroger cart. Each item requires a positive quantity and Kroger cart modality. This does not check out or place an order.",
      inputSchema: addToCartSchema.shape
    },
    async (input) => {
      const handler = async () => {
        const args = addToCartSchema.parse(input);
        return service.addToCart(args.items);
      };
      return safeTool(handler);
    }
  );
}
