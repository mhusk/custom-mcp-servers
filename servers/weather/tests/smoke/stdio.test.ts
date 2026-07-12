import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createServer } from "node:http";
import { afterAll, beforeAll, expect, it } from "vitest";

let url = "";
const http = createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.url?.startsWith("/v1/search"))
    res.end(
      JSON.stringify({
        results: [
          {
            id: 1,
            name: "Testville",
            country: "Testland",
            latitude: 1,
            longitude: 2,
            timezone: "Etc/GMT",
            elevation: 3
          }
        ]
      })
    );
  else
    res.end(
      JSON.stringify({
        latitude: 1,
        longitude: 2,
        elevation: 3,
        timezone: "Etc/GMT",
        utc_offset_seconds: 0,
        current_units: {
          temperature_2m: "°C",
          apparent_temperature: "°C",
          relative_humidity_2m: "%",
          precipitation: "mm",
          weather_code: "wmo code",
          wind_speed_10m: "km/h",
          wind_direction_10m: "°",
          wind_gusts_10m: "km/h"
        },
        current: {
          time: "2026-01-01T00:00",
          temperature_2m: 10,
          apparent_temperature: 9,
          relative_humidity_2m: 70,
          precipitation: 0,
          weather_code: 0,
          wind_speed_10m: 3,
          wind_direction_10m: 90,
          wind_gusts_10m: 5
        }
      })
    );
});
beforeAll(async () => {
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const address = http.address();
  if (!address || typeof address === "string") throw new Error("mock HTTP server failed");
  url = `http://127.0.0.1:${address.port}/v1`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => http.close((e) => (e ? reject(e) : resolve())));
});
it("launches built STDIO server, lists tools, and invokes deterministic providers", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/src/index.js"],
    cwd: process.cwd(),
    env: { ...process.env, OPEN_METEO_GEOCODING_BASE_URL: url, OPEN_METEO_FORECAST_BASE_URL: url }
  });
  const client = new Client({ name: "smoke", version: "1" });
  await client.connect(transport);
  const listed = await client.listTools();
  expect(listed.tools).toHaveLength(4);
  const search = await client.callTool({
    name: "search_locations",
    arguments: { query: "Testville" }
  });
  expect(search.structuredContent).toMatchObject({ candidates: [{ name: "Testville" }] });
  const weather = await client.callTool({
    name: "get_current_weather",
    arguments: { latitude: 1, longitude: 2 }
  });
  expect(weather.structuredContent).toMatchObject({
    temperature: 10,
    weatherDescription: "Clear sky"
  });
  await client.close();
});
