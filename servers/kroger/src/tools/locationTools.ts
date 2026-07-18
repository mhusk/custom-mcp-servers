import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { KrogerService } from "../services/krogerService.js";
import { safeTool } from "./result.js";

const nonEmpty = z.string().trim().min(1);
const limitString = (max: number) => z.string().trim().min(1).max(max);

const searchLocationsShape = {
  zipCode: limitString(10).optional(),
  latLong: limitString(50).optional(),
  latitude: limitString(20).optional(),
  longitude: limitString(20).optional(),
  radiusInMiles: z.number().positive().optional(),
  limit: z.number().int().positive().optional(),
  chain: limitString(100).optional(),
  departments: z.array(limitString(100)).min(1).optional()
};

export const searchLocationsSchema = z
  .object(searchLocationsShape)
  .superRefine((value, context) => {
    const coordinatePair = value.latitude !== undefined && value.longitude !== undefined;
    const incompletePair = (value.latitude === undefined) !== (value.longitude === undefined);
    const origins =
      Number(value.zipCode !== undefined) +
      Number(value.latLong !== undefined) +
      Number(coordinatePair);
    if (incompletePair || origins !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one origin: zipCode, latLong, or both latitude and longitude."
      });
    }
  });

export const getLocationSchema = z.object({ locationId: limitString(50) });

export function registerLocationTools(server: McpServer, service: KrogerService): void {
  server.registerTool(
    "search_locations",
    {
      title: "Search Kroger locations",
      description:
        "Read-only. Finds Kroger-family locations near exactly one origin: ZIP code, a latLong string, or a latitude/longitude pair. Optional filters narrow by radius, chain, and departments.",
      inputSchema: searchLocationsShape
    },
    async (input) => safeTool(() => service.searchLocations(searchLocationsSchema.parse(input)))
  );

  server.registerTool(
    "get_location",
    {
      title: "Get Kroger location details",
      description: "Read-only. Returns the complete Kroger response for one location ID.",
      inputSchema: getLocationSchema.shape
    },
    async (input) => {
      const handler = async () => {
        const args = getLocationSchema.parse(input);
        return service.getLocation(args.locationId);
      };
      return safeTool(handler);
    }
  );
}
