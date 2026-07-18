import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { KrogerService } from "../services/krogerService.js";
import { safeTool } from "./result.js";

const nonEmpty = z.string().trim().min(1);
const limitString = (max: number) => z.string().trim().min(1).max(max);

export const searchProductsSchema = z.object({
  term: limitString(200),
  locationId: limitString(50).optional(),
  brand: limitString(100).optional(),
  fulfillment: z.array(limitString(50)).min(1).optional(),
  start: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().optional()
});

export const getProductSchema = z.object({
  id: limitString(50),
  locationId: limitString(50).optional()
});

export function registerProductTools(server: McpServer, service: KrogerService): void {
  server.registerTool(
    "search_products",
    {
      title: "Search Kroger products",
      description:
        "Read-only. Searches Kroger products by term. A supplied locationId overrides KROGER_DEFAULT_LOCATION_ID; location-specific searches can include price and aisle data.",
      inputSchema: searchProductsSchema.shape
    },
    async (input) => safeTool(() => service.searchProducts(searchProductsSchema.parse(input)))
  );

  server.registerTool(
    "get_product",
    {
      title: "Get Kroger product details",
      description:
        "Read-only. Returns complete product details by Kroger product ID or UPC. A supplied locationId overrides KROGER_DEFAULT_LOCATION_ID.",
      inputSchema: getProductSchema.shape
    },
    async (input) => {
      const handler = async () => {
        const args = getProductSchema.parse(input);
        return service.getProduct(args.id, args.locationId);
      };
      return safeTool(handler);
    }
  );
}
