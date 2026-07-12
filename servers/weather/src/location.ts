import { z } from "zod";
import { OpenMeteoClient, ProviderError, finiteNumber } from "./client.js";

const candidateSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  admin1: z.string().optional(),
  admin2: z.string().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
  latitude: finiteNumber,
  longitude: finiteNumber,
  timezone: z.string().optional(),
  elevation: finiteNumber.nullable().optional()
});
const geocodeSchema = z.object({ results: z.array(candidateSchema).optional() });
export interface Location {
  id?: number;
  name?: string;
  admin1?: string;
  admin2?: string;
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  elevation?: number;
  displayName?: string;
}
export const attribution = {
  name: "Weather data by Open-Meteo.com",
  url: "https://open-meteo.com/"
} as const;
export function normalizeCandidate(value: z.infer<typeof candidateSchema>): Location {
  const parts = [value.name, value.admin2, value.admin1, value.country].filter(
    (v, i, a): v is string => Boolean(v) && a.indexOf(v) === i
  );
  return {
    ...(value.id === undefined ? {} : { id: value.id }),
    name: value.name,
    ...(value.admin1 ? { admin1: value.admin1 } : {}),
    ...(value.admin2 ? { admin2: value.admin2 } : {}),
    ...(value.country ? { country: value.country } : {}),
    ...(value.country_code ? { countryCode: value.country_code } : {}),
    latitude: value.latitude,
    longitude: value.longitude,
    ...(value.timezone ? { timezone: value.timezone } : {}),
    ...(value.elevation == null ? {} : { elevation: value.elevation }),
    displayName: parts.join(", ")
  };
}
const normalized = (s: string): string => s.trim().replace(/\s+/g, " ").toLocaleLowerCase();
export async function searchLocations(
  client: OpenMeteoClient,
  query: string,
  count = 5,
  language = "en"
): Promise<Location[]> {
  const parsed = geocodeSchema.safeParse(
    await client.geocode({ name: query, count, language, format: "json" })
  );
  if (!parsed.success)
    throw new ProviderError("Open-Meteo returned malformed geocoding data", "UPSTREAM_DATA");
  return (parsed.data.results ?? []).map(normalizeCandidate);
}
export async function resolveQuery(client: OpenMeteoClient, query: string): Promise<Location> {
  const candidates = await searchLocations(client, query, 10, "en");
  if (!candidates.length) throw new ProviderError(`No location found for “${query}”`, "NOT_FOUND");
  if (candidates.length === 1) return candidates[0]!;
  const exact = candidates.filter(
    (c) => c.displayName !== undefined && normalized(c.displayName) === normalized(query)
  );
  if (exact.length === 1) return exact[0]!;
  const choices = candidates
    .slice(0, 5)
    .map(
      (c) =>
        `${c.displayName ?? c.name ?? "Unnamed location"} (${c.latitude}, ${c.longitude}; ${c.timezone ?? "timezone unavailable"})`
    )
    .join("; ");
  throw new ProviderError(
    `Location is ambiguous. Retry using coordinates. Candidates: ${choices}`,
    "AMBIGUOUS_LOCATION"
  );
}
