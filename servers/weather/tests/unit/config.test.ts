import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  it("removes trailing slashes from custom Open-Meteo base URLs", () => {
    expect(
      loadConfig({
        OPEN_METEO_GEOCODING_BASE_URL: "https://geocoding.test/v1///",
        OPEN_METEO_FORECAST_BASE_URL: "https://forecast.test/v1///"
      })
    ).toMatchObject({
      geocodingBaseUrl: "https://geocoding.test/v1",
      forecastBaseUrl: "https://forecast.test/v1"
    });
  });
});
