import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, it, vi } from "vitest";
import { createServer } from "../../src/server.js";
import { WeatherService } from "../../src/service.js";

it("registers exactly four tools and returns structured and text content", async () => {
  const service = {
    locations: vi.fn().mockResolvedValue({
      candidates: [],
      source: { name: "Weather data by Open-Meteo.com", url: "https://open-meteo.com/" },
      retrievedAt: "2026-01-01T00:00:00.000Z"
    })
  } as unknown as WeatherService;
  const server = createServer(service);
  const client = new Client({ name: "test", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  const listed = await client.listTools();
  expect(listed.tools.map((t) => t.name).sort()).toEqual([
    "get_current_weather",
    "get_daily_forecast",
    "get_hourly_forecast",
    "search_locations"
  ]);
  const called = await client.callTool({
    name: "search_locations",
    arguments: { query: "Nowhere" }
  });
  expect(called.structuredContent).toMatchObject({ candidates: [] });
  expect(called.content).toEqual([
    { type: "text", text: expect.stringContaining("Open-Meteo.com") }
  ]);
  await client.close();
  await server.close();
});
