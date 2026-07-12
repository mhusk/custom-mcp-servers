import { describe, expect, it, vi } from "vitest";
import { OpenMeteoClient } from "../../src/client.js";
import { resolveQuery, searchLocations } from "../../src/location.js";
const candidate = (name: string, extra = {}) => ({
  name,
  latitude: 42,
  longitude: -83,
  country: "United States",
  country_code: "US",
  timezone: "America/Detroit",
  ...extra
});
const client = (results: unknown[]) =>
  ({ geocode: vi.fn().mockResolvedValue({ results }) }) as unknown as OpenMeteoClient;
describe("locations", () => {
  it("normalizes candidates and display names", async () =>
    expect(
      (
        await searchLocations(
          client([candidate("Detroit", { admin1: "Michigan", elevation: null })]),
          "Detroit"
        )
      )[0]
    ).toEqual({
      name: "Detroit",
      admin1: "Michigan",
      country: "United States",
      countryCode: "US",
      latitude: 42,
      longitude: -83,
      timezone: "America/Detroit",
      displayName: "Detroit, Michigan, United States"
    }));
  it("returns empty search results", async () =>
    expect(await searchLocations(client([]), "Nowhere")).toEqual([]));
  it("selects a single result", async () =>
    expect((await resolveQuery(client([candidate("Detroit")]), "Detroit")).name).toBe("Detroit"));
  it("selects an exact normalized display name", async () =>
    expect(
      (
        await resolveQuery(
          client([
            candidate("Detroit", { admin1: "Michigan" }),
            candidate("Detroit", { admin1: "Texas" })
          ]),
          "  detroit,   michigan, united states "
        )
      ).admin1
    ).toBe("Michigan"));
  it("rejects ambiguity", async () =>
    expect(
      resolveQuery(
        client([candidate("Paris", { country: "France" }), candidate("Paris", { country: "US" })]),
        "Paris"
      )
    ).rejects.toThrow(/Retry using coordinates/));
  it("rejects no result", async () =>
    expect(resolveQuery(client([]), "Nowhere")).rejects.toThrow(/No location found/));
});
