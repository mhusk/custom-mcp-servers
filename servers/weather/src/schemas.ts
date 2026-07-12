import { z } from "zod";

const query = z.string().trim().min(2).max(100);
const units = {
  temperatureUnit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  windSpeedUnit: z.enum(["kmh", "mph", "ms", "kn"]).default("kmh")
};
const location = {
  query: query.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
};
function locationCheck(
  value: { query?: string; latitude?: number; longitude?: number },
  ctx: z.RefinementCtx
): void {
  const q = value.query !== undefined,
    lat = value.latitude !== undefined,
    lon = value.longitude !== undefined;
  if ((q && (lat || lon)) || (!q && !lat && !lon) || lat !== lon)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide exactly one location mode: query, or both latitude and longitude"
    });
}
export const searchLocationsInput = z
  .object({
    query,
    count: z.number().int().min(1).max(10).default(5),
    language: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .transform((v) => v.toLowerCase())
      .default("en")
  })
  .strict();
export const currentWeatherInput = z
  .object({ ...location, ...units })
  .strict()
  .superRefine(locationCheck);
export const hourlyForecastInput = z
  .object({ ...location, ...units, hours: z.number().int().min(1).max(168).default(24) })
  .strict()
  .superRefine(locationCheck);
export const dailyForecastInput = z
  .object({ ...location, ...units, days: z.number().int().min(1).max(16).default(7) })
  .strict()
  .superRefine(locationCheck);
export type WeatherInput = z.infer<typeof currentWeatherInput>;
