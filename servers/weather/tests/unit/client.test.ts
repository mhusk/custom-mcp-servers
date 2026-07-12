import { describe, expect, it, vi } from "vitest";
import { OpenMeteoClient } from "../../src/client.js";
const make = (fetcher: typeof fetch, timeoutMs = 1000) =>
  new OpenMeteoClient({
    geocodingBaseUrl: "https://geo.test/v1",
    forecastBaseUrl: "https://forecast.test/v1",
    timeoutMs,
    fetcher
  });
describe("provider client", () => {
  it("sets URL params and user agent", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}"));
    await make(f).geocode({ name: "Detroit" });
    expect(String(f.mock.calls[0]![0])).toContain("name=Detroit");
    expect(f.mock.calls[0]![1].headers["User-Agent"]).toContain("@custom-mcp/weather/0.1.0");
  });
  it("handles network failure", async () =>
    expect(make(vi.fn().mockRejectedValue(new TypeError("dns"))).forecast({})).rejects.toThrow(
      /network/
    ));
  it("handles timeout", async () => {
    const e = new Error();
    e.name = "TimeoutError";
    await expect(make(vi.fn().mockRejectedValue(e)).forecast({})).rejects.toThrow(/timed out/);
  });
  it("handles 429 safely", async () =>
    expect(
      make(
        vi
          .fn()
          .mockResolvedValue(
            new Response("secret", { status: 429, headers: { "retry-after": "10" } })
          )
      ).forecast({})
    ).rejects.toThrow(/retry after 10/));
  it("handles other HTTP errors without body", async () =>
    expect(
      make(
        vi.fn().mockResolvedValue(new Response("<html>secret</html>", { status: 500 }))
      ).forecast({})
    ).rejects.not.toThrow(/secret/));
  it("handles invalid JSON", async () =>
    expect(make(vi.fn().mockResolvedValue(new Response("not-json"))).forecast({})).rejects.toThrow(
      /invalid JSON/
    ));
  it("handles malformed payload through location validation", async () =>
    expect(
      searchBad(make(vi.fn().mockResolvedValue(new Response('{"results":[{}]}'))))
    ).rejects.toThrow(/malformed/));
});
async function searchBad(client: OpenMeteoClient) {
  const { searchLocations } = await import("../../src/location.js");
  return searchLocations(client, "Detroit");
}
