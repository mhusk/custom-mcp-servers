import { describe, expect, it } from "vitest";

import { KrogerClient } from "../../src/clients/krogerClient.js";

const accessToken = process.env.KROGER_ACCESS_TOKEN;
const locationId = process.env.KROGER_DEFAULT_LOCATION_ID;
const runIntegration = accessToken && locationId ? describe : describe.skip;

runIntegration("Kroger read-only integration", () => {
  it("retrieves the configured location without mutating a cart", async () => {
    const client = new KrogerClient({
      accessToken: accessToken as string,
      baseUrl: (process.env.KROGER_API_BASE_URL ?? "https://api.kroger.com/v1").replace(/\/+$/, "")
    });
    const response = await client.getLocation(locationId as string);
    expect(response.data).toBeDefined();
  });
});
