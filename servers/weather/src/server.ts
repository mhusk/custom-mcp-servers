import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WeatherService } from "./service.js";
import {
  currentWeatherInput,
  dailyForecastInput,
  hourlyForecastInput,
  searchLocationsInput
} from "./schemas.js";

const text = (value: unknown): string => JSON.stringify(value);
const result = (value: Record<string, unknown>) => ({
  structuredContent: value,
  content: [{ type: "text" as const, text: text(value) }]
});
export function createServer(service: WeatherService): McpServer {
  const server = new McpServer({ name: "weather", version: "0.1.0" });
  server.registerTool(
    "search_locations",
    {
      description: "Search globally for normalized locations using Open-Meteo.",
      inputSchema: searchLocationsInput,
      outputSchema: z.object({
        candidates: z.array(z.record(z.unknown())),
        source: z.record(z.string()),
        retrievedAt: z.string()
      })
    },
    async (input) => result(await service.locations(input.query, input.count, input.language))
  );
  server.registerTool(
    "get_current_weather",
    {
      description: "Get current weather for a place query or coordinates.",
      inputSchema: currentWeatherInput,
      outputSchema: z.object({}).passthrough()
    },
    async (input) => result(await service.current(input))
  );
  server.registerTool(
    "get_hourly_forecast",
    {
      description: "Get future hourly weather for a place query or coordinates.",
      inputSchema: hourlyForecastInput,
      outputSchema: z.object({}).passthrough()
    },
    async (input) => result(await service.hourly(input))
  );
  server.registerTool(
    "get_daily_forecast",
    {
      description: "Get a daily weather forecast for a place query or coordinates.",
      inputSchema: dailyForecastInput,
      outputSchema: z.object({}).passthrough()
    },
    async (input) => result(await service.daily(input))
  );
  return server;
}
