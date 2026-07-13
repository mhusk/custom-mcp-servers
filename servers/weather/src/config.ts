import { z } from "zod";

const timeoutSchema = z.coerce.number().int().min(1000).max(60000);
export interface Config {
  geocodingBaseUrl: string;
  forecastBaseUrl: string;
  timeoutMs: number;
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const url = (value: string | undefined, fallback: string): string => {
    const parsed = z
      .string()
      .url()
      .safeParse(value ?? fallback);
    if (!parsed.success) throw new Error("Open-Meteo base URL must be a valid URL");
    return parsed.data.replace(/\/+$/, "");
  };
  const timeout = timeoutSchema.safeParse(env.OPEN_METEO_TIMEOUT_MS ?? "10000");
  if (!timeout.success)
    throw new Error("OPEN_METEO_TIMEOUT_MS must be an integer from 1000 to 60000");
  return {
    geocodingBaseUrl: url(
      env.OPEN_METEO_GEOCODING_BASE_URL,
      "https://geocoding-api.open-meteo.com/v1"
    ),
    forecastBaseUrl: url(env.OPEN_METEO_FORECAST_BASE_URL, "https://api.open-meteo.com/v1"),
    timeoutMs: timeout.data
  };
}
