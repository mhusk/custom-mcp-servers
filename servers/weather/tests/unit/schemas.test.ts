import { describe, expect, it } from "vitest";
import {
  currentWeatherInput,
  dailyForecastInput,
  hourlyForecastInput,
  searchLocationsInput
} from "../../src/schemas.js";

describe("public input schemas", () => {
  it("applies search defaults and trims", () =>
    expect(searchLocationsInput.parse({ query: "  Detroit  " })).toEqual({
      query: "Detroit",
      count: 5,
      language: "en"
    }));
  it.each([
    { query: "x" },
    { query: "x".repeat(101) },
    { query: "ok", count: 0 },
    { query: "ok", count: 11 },
    { query: "ok", count: 1.2 },
    { query: "ok", language: "eng" },
    { query: "ok", extra: true }
  ])("rejects invalid search %#", (value) =>
    expect(searchLocationsInput.safeParse(value).success).toBe(false)
  );
  it("applies weather defaults", () =>
    expect(currentWeatherInput.parse({ latitude: 0, longitude: 0 })).toMatchObject({
      temperatureUnit: "celsius",
      windSpeedUnit: "kmh"
    }));
  it.each([
    { query: "Detroit", latitude: 1, longitude: 2 },
    {},
    { latitude: 1 },
    { longitude: 1 },
    { latitude: -91, longitude: 0 },
    { latitude: 0, longitude: 181 },
    { query: "x" },
    { query: "Detroit", temperatureUnit: "kelvin" },
    { query: "Detroit", windSpeedUnit: "fps" }
  ])("rejects invalid location/unit %#", (value) =>
    expect(currentWeatherInput.safeParse(value).success).toBe(false)
  );
  it.each([1, 168])("accepts hourly boundary %s", (hours) =>
    expect(hourlyForecastInput.safeParse({ query: "Detroit", hours }).success).toBe(true)
  );
  it.each([0, 169, 1.5])("rejects hourly %s", (hours) =>
    expect(hourlyForecastInput.safeParse({ query: "Detroit", hours }).success).toBe(false)
  );
  it.each([1, 16])("accepts daily boundary %s", (days) =>
    expect(dailyForecastInput.safeParse({ query: "Detroit", days }).success).toBe(true)
  );
  it.each([0, 17, 1.5])("rejects daily %s", (days) =>
    expect(dailyForecastInput.safeParse({ query: "Detroit", days }).success).toBe(false)
  );
});
