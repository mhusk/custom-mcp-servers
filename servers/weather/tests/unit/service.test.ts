import { describe, expect, it, vi } from "vitest";
import { OpenMeteoClient } from "../../src/client.js";
import { WeatherService } from "../../src/service.js";

const base = {
  latitude: 42.3,
  longitude: -83,
  elevation: 200,
  timezone: "America/Detroit",
  utc_offset_seconds: -14400
};
const units = {
  temperature_2m: "°F",
  apparent_temperature: "°F",
  relative_humidity_2m: "%",
  precipitation: "inch",
  weather_code: "wmo code",
  wind_speed_10m: "mph",
  wind_direction_10m: "°",
  wind_gusts_10m: "mph"
};
const clientWith = (raw: unknown) =>
  ({ forecast: vi.fn().mockResolvedValue(raw) }) as unknown as OpenMeteoClient;
const input = {
  latitude: 42.3,
  longitude: -83,
  temperatureUnit: "fahrenheit" as const,
  windSpeedUnit: "mph" as const
};

describe("weather normalization", () => {
  it("normalizes current metadata, units, attribution, and nulls", async () => {
    const service = new WeatherService(
      clientWith({
        ...base,
        current_units: units,
        current: {
          time: "2026-07-11T10:00",
          temperature_2m: 70,
          apparent_temperature: 71,
          relative_humidity_2m: 50,
          precipitation: null,
          weather_code: 2,
          wind_speed_10m: 5,
          wind_direction_10m: 180,
          wind_gusts_10m: 8
        }
      }),
      { now: () => new Date("2026-07-11T14:30:00Z") }
    );
    const result = await service.current(input);
    expect(result).toMatchObject({
      timezone: "America/Detroit",
      utcOffsetSeconds: -14400,
      temperature: 70,
      precipitation: null,
      weatherDescription: "Partly cloudy",
      units,
      source: { name: "Weather data by Open-Meteo.com", url: "https://open-meteo.com/" },
      retrievedAt: "2026-07-11T14:30:00.000Z"
    });
    expect(result.location).toMatchObject({
      latitude: 42.3,
      longitude: -83,
      elevation: 200
    });
    expect(result.location).not.toHaveProperty("name");
    expect(result.location).not.toHaveProperty("displayName");
  });
  it("selects from the current local hour and truncates exactly", async () => {
    const times = ["2026-07-11T09:00", "2026-07-11T10:00", "2026-07-11T11:00", "2026-07-11T12:00"];
    const values = [1, 2, 3, 4];
    const hourly = {
      time: times,
      temperature_2m: values,
      apparent_temperature: values,
      relative_humidity_2m: values,
      precipitation_probability: values,
      precipitation: [null, 0, 0, 0],
      weather_code: [0, 1, 2, 3],
      wind_speed_10m: values,
      wind_direction_10m: values,
      wind_gusts_10m: values
    };
    const service = new WeatherService(clientWith({ ...base, hourly_units: units, hourly }), {
      now: () => new Date("2026-07-11T14:30:00Z")
    });
    const result = await service.hourly({ ...input, hours: 2 });
    expect(result.records.map((r) => r.time)).toEqual(["2026-07-11T10:00", "2026-07-11T11:00"]);
    expect(result.records[0]!.precipitation).toBe(0);
  });
  it("rejects misaligned hourly arrays", async () => {
    const hourly = {
      time: ["2026-07-11T10:00"],
      temperature_2m: [],
      apparent_temperature: [1],
      relative_humidity_2m: [1],
      precipitation_probability: [1],
      precipitation: [1],
      weather_code: [1],
      wind_speed_10m: [1],
      wind_direction_10m: [1],
      wind_gusts_10m: [1]
    };
    await expect(
      new WeatherService(clientWith({ ...base, hourly_units: units, hourly })).hourly({
        ...input,
        hours: 1
      })
    ).rejects.toThrow(/inconsistent hourly/);
  });
  it("normalizes daily records and nulls", async () => {
    const daily = {
      time: ["2026-07-11"],
      weather_code: [95],
      temperature_2m_max: [80],
      temperature_2m_min: [60],
      apparent_temperature_max: [82],
      apparent_temperature_min: [null],
      precipitation_sum: [0.1],
      precipitation_probability_max: [40],
      sunrise: ["2026-07-11T06:00"],
      sunset: ["2026-07-11T21:00"],
      wind_speed_10m_max: [12],
      wind_gusts_10m_max: [20],
      wind_direction_10m_dominant: [220]
    };
    const result = await new WeatherService(clientWith({ ...base, daily_units: units, daily }), {
      now: () => new Date("2026-07-11T12:00:00Z")
    }).daily({ ...input, days: 1 });
    expect(result.records[0]).toMatchObject({
      date: "2026-07-11",
      weatherDescription: "Thunderstorm",
      minimumApparentTemperature: null,
      maximumWindGust: 20
    });
    expect(result.units).toEqual(units);
  });
  it("rejects malformed and misaligned daily payloads", async () => {
    await expect(
      new WeatherService(clientWith({ nope: true })).daily({ ...input, days: 1 })
    ).rejects.toThrow(/malformed daily/);
    const d = {
      time: ["x"],
      weather_code: [],
      temperature_2m_max: [1],
      temperature_2m_min: [1],
      apparent_temperature_max: [1],
      apparent_temperature_min: [1],
      precipitation_sum: [1],
      precipitation_probability_max: [1],
      sunrise: ["x"],
      sunset: ["x"],
      wind_speed_10m_max: [1],
      wind_gusts_10m_max: [1],
      wind_direction_10m_dominant: [1]
    };
    await expect(
      new WeatherService(clientWith({ ...base, daily_units: units, daily: d })).daily({
        ...input,
        days: 1
      })
    ).rejects.toThrow(/inconsistent daily/);
  });
});
