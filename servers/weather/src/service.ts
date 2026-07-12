import { z } from "zod";
import { finiteNumber, OpenMeteoClient, ProviderError } from "./client.js";
import { attribution, Location, resolveQuery } from "./location.js";
import { WeatherInput } from "./schemas.js";
import { weatherCodeDescription } from "./weatherCodes.js";

const nullable = finiteNumber.nullable();
const base = z.object({
  latitude: finiteNumber,
  longitude: finiteNumber,
  elevation: finiteNumber.optional(),
  timezone: z.string(),
  timezone_abbreviation: z.string().optional(),
  utc_offset_seconds: z.number().int()
});
const unitsSchema = z.record(z.string());
const currentSchema = base.extend({
  current_units: unitsSchema,
  current: z.object({
    time: z.string(),
    temperature_2m: nullable,
    apparent_temperature: nullable,
    relative_humidity_2m: nullable,
    precipitation: nullable,
    weather_code: nullable,
    wind_speed_10m: nullable,
    wind_direction_10m: nullable,
    wind_gusts_10m: nullable
  })
});
const hourlySchema = base.extend({
  hourly_units: unitsSchema,
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(nullable),
    apparent_temperature: z.array(nullable),
    relative_humidity_2m: z.array(nullable),
    precipitation_probability: z.array(nullable),
    precipitation: z.array(nullable),
    weather_code: z.array(nullable),
    wind_speed_10m: z.array(nullable),
    wind_direction_10m: z.array(nullable),
    wind_gusts_10m: z.array(nullable)
  })
});
const dailySchema = base.extend({
  daily_units: unitsSchema,
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(nullable),
    temperature_2m_max: z.array(nullable),
    temperature_2m_min: z.array(nullable),
    apparent_temperature_max: z.array(nullable),
    apparent_temperature_min: z.array(nullable),
    precipitation_sum: z.array(nullable),
    precipitation_probability_max: z.array(nullable),
    sunrise: z.array(z.string().nullable()),
    sunset: z.array(z.string().nullable()),
    wind_speed_10m_max: z.array(nullable),
    wind_gusts_10m_max: z.array(nullable),
    wind_direction_10m_dominant: z.array(nullable)
  })
});

export interface ServiceOptions {
  now?: () => Date;
}
export class WeatherService {
  private readonly now: () => Date;
  constructor(
    private readonly client: OpenMeteoClient,
    options: ServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }
  async locations(query: string, count: number, language: string) {
    const { searchLocations } = await import("./location.js");
    return {
      candidates: await searchLocations(this.client, query, count, language),
      source: attribution,
      retrievedAt: this.now().toISOString()
    };
  }
  private async request(
    input: WeatherInput,
    variables: Record<string, string | number>
  ): Promise<{ raw: unknown; requested?: Location }> {
    const requested = input.query ? await resolveQuery(this.client, input.query) : undefined;
    const latitude = requested?.latitude ?? input.latitude!;
    const longitude = requested?.longitude ?? input.longitude!;
    return {
      requested,
      raw: await this.client.forecast({
        latitude,
        longitude,
        timezone: "auto",
        temperature_unit: input.temperatureUnit,
        wind_speed_unit: input.windSpeedUnit,
        ...variables
      })
    };
  }
  private location(raw: z.infer<typeof base>, requested?: Location): Location {
    return {
      ...(requested?.id === undefined ? {} : { id: requested.id }),
      ...(requested?.name ? { name: requested.name } : {}),
      ...(requested?.admin1 ? { admin1: requested.admin1 } : {}),
      ...(requested?.admin2 ? { admin2: requested.admin2 } : {}),
      ...(requested?.country ? { country: requested.country } : {}),
      ...(requested?.countryCode ? { countryCode: requested.countryCode } : {}),
      latitude: raw.latitude,
      longitude: raw.longitude,
      timezone: raw.timezone,
      ...(raw.elevation === undefined ? {} : { elevation: raw.elevation }),
      ...(requested?.displayName ? { displayName: requested.displayName } : {})
    };
  }
  async current(input: WeatherInput) {
    const { raw, requested } = await this.request(input, {
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
    });
    const p = currentSchema.safeParse(raw);
    if (!p.success)
      throw new ProviderError(
        "Open-Meteo returned malformed current-weather data",
        "UPSTREAM_DATA"
      );
    const c = p.data.current;
    return {
      location: this.location(p.data, requested),
      observationTime: c.time,
      timezone: p.data.timezone,
      utcOffsetSeconds: p.data.utc_offset_seconds,
      temperature: c.temperature_2m,
      apparentTemperature: c.apparent_temperature,
      relativeHumidity: c.relative_humidity_2m,
      precipitation: c.precipitation,
      weatherCode: c.weather_code,
      weatherDescription:
        c.weather_code === null
          ? "Unknown weather condition"
          : weatherCodeDescription(c.weather_code),
      windSpeed: c.wind_speed_10m,
      windDirection: c.wind_direction_10m,
      windGusts: c.wind_gusts_10m,
      units: p.data.current_units,
      source: attribution,
      retrievedAt: this.now().toISOString()
    };
  }
  async hourly(input: WeatherInput & { hours: number }) {
    const { raw, requested } = await this.request(input, {
      forecast_hours: input.hours + 1,
      hourly:
        "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
    });
    const p = hourlySchema.safeParse(raw);
    if (!p.success)
      throw new ProviderError("Open-Meteo returned malformed hourly data", "UPSTREAM_DATA");
    const h = p.data.hourly;
    const arrays = Object.values(h);
    const length = h.time.length;
    if (arrays.some((a) => a.length !== length))
      throw new ProviderError(
        "Open-Meteo returned inconsistent hourly array lengths",
        "UPSTREAM_DATA"
      );
    const localHour =
      new Date(this.now().getTime() + p.data.utc_offset_seconds * 1000).toISOString().slice(0, 13) +
      ":00";
    const start = h.time.findIndex((t) => t >= localHour);
    const from = start < 0 ? length : start;
    const records = h.time.slice(from, from + input.hours).map((time, i) => {
      const n = from + i,
        code = h.weather_code[n]!;
      return {
        time,
        temperature: h.temperature_2m[n]!,
        apparentTemperature: h.apparent_temperature[n]!,
        relativeHumidity: h.relative_humidity_2m[n]!,
        precipitationProbability: h.precipitation_probability[n]!,
        precipitation: h.precipitation[n]!,
        weatherCode: code,
        weatherDescription:
          code === null ? "Unknown weather condition" : weatherCodeDescription(code),
        windSpeed: h.wind_speed_10m[n]!,
        windDirection: h.wind_direction_10m[n]!,
        windGusts: h.wind_gusts_10m[n]!
      };
    });
    return {
      location: this.location(p.data, requested),
      timezone: p.data.timezone,
      utcOffsetSeconds: p.data.utc_offset_seconds,
      units: p.data.hourly_units,
      source: attribution,
      retrievedAt: this.now().toISOString(),
      records
    };
  }
  async daily(input: WeatherInput & { days: number }) {
    const { raw, requested } = await this.request(input, {
      forecast_days: input.days,
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant"
    });
    const p = dailySchema.safeParse(raw);
    if (!p.success)
      throw new ProviderError("Open-Meteo returned malformed daily data", "UPSTREAM_DATA");
    const d = p.data.daily;
    const length = d.time.length;
    if (Object.values(d).some((a) => a.length !== length))
      throw new ProviderError(
        "Open-Meteo returned inconsistent daily array lengths",
        "UPSTREAM_DATA"
      );
    const records = d.time.slice(0, input.days).map((date, i) => {
      const code = d.weather_code[i]!;
      return {
        date,
        weatherCode: code,
        weatherDescription:
          code === null ? "Unknown weather condition" : weatherCodeDescription(code),
        maximumTemperature: d.temperature_2m_max[i]!,
        minimumTemperature: d.temperature_2m_min[i]!,
        maximumApparentTemperature: d.apparent_temperature_max[i]!,
        minimumApparentTemperature: d.apparent_temperature_min[i]!,
        precipitationSum: d.precipitation_sum[i]!,
        maximumPrecipitationProbability: d.precipitation_probability_max[i]!,
        sunrise: d.sunrise[i]!,
        sunset: d.sunset[i]!,
        maximumWindSpeed: d.wind_speed_10m_max[i]!,
        maximumWindGust: d.wind_gusts_10m_max[i]!,
        dominantWindDirection: d.wind_direction_10m_dominant[i]!
      };
    });
    return {
      location: this.location(p.data, requested),
      timezone: p.data.timezone,
      utcOffsetSeconds: p.data.utc_offset_seconds,
      units: p.data.daily_units,
      source: attribution,
      retrievedAt: this.now().toISOString(),
      records
    };
  }
}
