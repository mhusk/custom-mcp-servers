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
const locationSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().optional(),
  admin1: z.string().optional(),
  admin2: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  elevation: z.number().optional(),
  displayName: z.string().optional()
});

const attributionSchema = z.object({
  name: z.string(),
  url: z.string()
});

const currentWeatherOutput = z.object({
  location: locationSchema,
  observationTime: z.string(),
  timezone: z.string(),
  utcOffsetSeconds: z.number().int(),
  temperature: z.number().nullable(),
  apparentTemperature: z.number().nullable(),
  relativeHumidity: z.number().nullable(),
  precipitation: z.number().nullable(),
  weatherCode: z.number().nullable(),
  weatherDescription: z.string(),
  windSpeed: z.number().nullable(),
  windDirection: z.number().nullable(),
  windGusts: z.number().nullable(),
  units: z.record(z.string()),
  source: attributionSchema,
  retrievedAt: z.string()
});

const hourlyForecastOutput = z.object({
  location: locationSchema,
  timezone: z.string(),
  utcOffsetSeconds: z.number().int(),
  units: z.record(z.string()),
  source: attributionSchema,
  retrievedAt: z.string(),
  records: z.array(
    z.object({
      time: z.string(),
      temperature: z.number().nullable(),
      apparentTemperature: z.number().nullable(),
      relativeHumidity: z.number().nullable(),
      precipitationProbability: z.number().nullable(),
      precipitation: z.number().nullable(),
      weatherCode: z.number().nullable(),
      weatherDescription: z.string(),
      windSpeed: z.number().nullable(),
      windDirection: z.number().nullable(),
      windGusts: z.number().nullable()
    })
  )
});

const dailyForecastOutput = z.object({
  location: locationSchema,
  timezone: z.string(),
  utcOffsetSeconds: z.number().int(),
  units: z.record(z.string()),
  source: attributionSchema,
  retrievedAt: z.string(),
  records: z.array(
    z.object({
      date: z.string(),
      weatherCode: z.number().nullable(),
      weatherDescription: z.string(),
      maximumTemperature: z.number().nullable(),
      minimumTemperature: z.number().nullable(),
      maximumApparentTemperature: z.number().nullable(),
      minimumApparentTemperature: z.number().nullable(),
      precipitationSum: z.number().nullable(),
      maximumPrecipitationProbability: z.number().nullable(),
      sunrise: z.string().nullable(),
      sunset: z.string().nullable(),
      maximumWindSpeed: z.number().nullable(),
      maximumWindGust: z.number().nullable(),
      dominantWindDirection: z.number().nullable()
    })
  )
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
      outputSchema: currentWeatherOutput
    },
    async (input) => result(await service.current(input))
  );
  server.registerTool(
    "get_hourly_forecast",
    {
      description: "Get future hourly weather for a place query or coordinates.",
      inputSchema: hourlyForecastInput,
      outputSchema: hourlyForecastOutput
    },
    async (input) => result(await service.hourly(input))
  );
  server.registerTool(
    "get_daily_forecast",
    {
      description: "Get a daily weather weather forecast for a place query or coordinates.",
      inputSchema: dailyForecastInput,
      outputSchema: dailyForecastOutput
    },
    async (input) => result(await service.daily(input))
  );
  return server;
}
