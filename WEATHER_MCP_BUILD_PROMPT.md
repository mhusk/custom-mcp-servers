# Build Prompt: Free Open-Meteo Weather MCP

Copy everything below the divider into a new Codex task or give it to another implementation agent.

---

You are working in the `custom-mcp-servers` repository. Build and fully verify a new local weather MCP server at `servers/weather`.

## Goal

Create a focused, read-only STDIO MCP server backed by Open-Meteo for personal, non-commercial use. It must provide global location search, current conditions, hourly forecasts, and daily forecasts without requiring an API key.

Inspect `servers/trello` and `servers/kroger` before editing. Match their repository conventions where applicable: independent Node.js package, TypeScript, Node 22+, ESM, the official `@modelcontextprotocol/sdk`, Zod validation, Vitest tests, ESLint, Prettier, build output under `dist`, and documentation for Codex Desktop registration. Do not copy domain-specific behavior or credentials from those servers.

Use the current stable dependency versions already established by this repository unless compatibility requires a newer version. Commit no secrets, generated dependencies, or build artifacts.

## Provider and usage constraints

- Use Open-Meteo's public geocoding API and forecast API directly.
- Default geocoding base URL: `https://geocoding-api.open-meteo.com/v1`.
- Default forecast base URL: `https://api.open-meteo.com/v1`.
- Allow both base URLs to be overridden with environment variables so tests can use controlled endpoints.
- Require no API key, signup, credential environment variable, or credential tool argument.
- Treat the hosted free API as personal/non-commercial, best-effort infrastructure. Document its current 10,000-call-per-day fair-use limit and lack of uptime guarantee.
- Include `Weather data by Open-Meteo.com` and `https://open-meteo.com/` in every successful weather result. Include equivalent source metadata in location-search results.
- Do not expose an arbitrary URL fetcher, generic HTTP request tool, historical data, alerts, air quality, marine data, radar, river data, or wildfire data.

## MCP tools

Implement exactly these four public tools. Tool names and primary argument names are part of the interface and must remain stable.

### `search_locations`

Input:

```json
{
  "query": "Detroit, MI",
  "count": 5,
  "language": "en"
}
```

- `query`: required trimmed string, 2-100 characters; accepts a city, postal code, or place name.
- `count`: optional integer, default 5, range 1-10.
- `language`: optional two-letter language code, default `en`.
- Return normalized candidates containing `id` when supplied upstream, `name`, `admin1`, `admin2`, `country`, `countryCode`, `latitude`, `longitude`, `timezone`, `elevation`, and a deterministic human-readable `displayName`. Omit unavailable optional fields rather than inventing values.
- Return an empty candidate array for a valid query with no matches.

### `get_current_weather`

Input accepts exactly one location mode:

```json
{
  "query": "Detroit, MI",
  "temperatureUnit": "fahrenheit",
  "windSpeedUnit": "mph"
}
```

or:

```json
{
  "latitude": 42.3314,
  "longitude": -83.0458,
  "temperatureUnit": "celsius",
  "windSpeedUnit": "kmh"
}
```

- `query`: trimmed string, 2-100 characters.
- Coordinates: latitude -90 through 90 and longitude -180 through 180; both are required together.
- Reject inputs containing both a query and coordinates, or neither.
- `temperatureUnit`: optional `celsius` or `fahrenheit`, default `celsius`.
- `windSpeedUnit`: optional `kmh`, `mph`, `ms`, or `kn`, default `kmh`.
- Return normalized location metadata, observation time, timezone, UTC offset, temperature, apparent temperature, relative humidity, precipitation, weather-code number and description, wind speed, wind direction, wind gusts, units, source attribution, and a retrieval timestamp.

### `get_hourly_forecast`

Use the same mutually exclusive location input and unit fields as current weather, plus:

- `hours`: optional integer, default 24, range 1-168.
- Return exactly the requested number of future hourly records when upstream data permits, beginning at the first forecast timestamp equal to or later than the current local hour.
- Each record must include time, temperature, apparent temperature, relative humidity, precipitation probability, precipitation, weather code and description, wind speed, wind direction, and wind gusts.
- Return normalized location, timezone, UTC offset, units, attribution, retrieval timestamp, and the records array.

### `get_daily_forecast`

Use the same mutually exclusive location input and unit fields as current weather, plus:

- `days`: optional integer, default 7, range 1-16.
- Each daily record must include date, weather code and description, maximum and minimum temperature, maximum and minimum apparent temperature, precipitation sum, maximum precipitation probability, sunrise, sunset, maximum wind speed, maximum wind gust, and dominant wind direction.
- Return normalized location, timezone, UTC offset, units, attribution, retrieval timestamp, and the records array.

## Location resolution

- For query-based weather requests, call Open-Meteo geocoding with enough candidates to detect ambiguity.
- Normalize query and candidate labels for case and whitespace.
- Automatically accept a single result or an unambiguous exact match on the normalized `displayName`.
- If multiple plausible results remain, return a clear MCP tool error listing up to five normalized candidates with display name, country, coordinates, and timezone. Tell the caller to retry using coordinates; never silently choose the first result.
- If no location matches, return a clear not-found tool error.
- For coordinate requests, use Open-Meteo's returned latitude, longitude, elevation, and timezone as canonical metadata. A place name is optional and must not be fabricated.

## Forecast request and normalization rules

- Request `timezone=auto` so timestamps are expressed in the resolved location's timezone.
- Ask Open-Meteo to perform requested temperature and wind unit conversion. Preserve and validate the units returned in the upstream response; do not relabel values locally.
- Request only the variables needed by the selected tool.
- Map WMO/Open-Meteo weather codes to stable English descriptions in a pure, exhaustively tested function. Preserve the numeric code. Unknown codes must map to `Unknown weather condition`, not throw.
- Validate upstream JSON before normalization. Do not return partially aligned time-series arrays: detect inconsistent array lengths and report an upstream-data error.
- Represent unavailable numeric observations as `null` only when the output schema permits it; do not turn missing data into zero.
- Use ISO-8601 retrieval timestamps. Preserve Open-Meteo local forecast timestamps and include the returned timezone and UTC offset so callers can interpret them correctly.
- Keep MCP responses structured and machine-readable. Return both `structuredContent` and a concise text serialization/summary compatible with MCP clients that primarily consume text.

## Reliability, errors, and transport safety

- Use the platform `fetch` implementation and apply an abort timeout configurable through `OPEN_METEO_TIMEOUT_MS`, defaulting to 10,000 ms. Validate the environment value and bound it to a safe range of 1,000-60,000 ms.
- Identify the server with an explicit `User-Agent` header containing its package name and version.
- Handle timeout, DNS/network failure, non-2xx status, HTTP 429, invalid JSON, malformed payload, no results, ambiguous location, and inconsistent arrays with concise actionable MCP errors.
- Do not leak raw HTML bodies or excessively large upstream payloads in errors. Include safe status and retry information when available.
- Reserve stdout exclusively for STDIO MCP protocol messages. Send any diagnostic logging to stderr, and never log complete responses or user secrets.
- Keep the provider client, schemas, location resolution, weather-code mapping, and MCP tool registration separated enough to unit-test without launching a subprocess.

## Package, files, and documentation

Create the complete independent package under `servers/weather`, including:

- `package.json` and lockfile;
- strict TypeScript configuration;
- ESLint and Prettier configuration consistent with sibling servers;
- source code and unit tests;
- `.gitignore` and `.env.example` containing only optional base-URL and timeout settings;
- a thorough `README.md`.

The package scripts must support:

```text
npm run build
npm run start
npm run dev
npm run typecheck
npm run lint
npm run format
npm test
npm run test:watch
```

Document prerequisites, install/build/run steps, all four tools with examples, optional environment variables, error behavior, the absence of required credentials, Open-Meteo attribution and hosted-free-tier restrictions, and Codex Desktop registration using:

- Name: `weather`
- Transport: `STDIO`
- Command: `node`
- Arguments: `dist/src/index.js`
- Working directory: the absolute or user-supplied path to `servers/weather`

Update the repository root `README.md` to add Weather to the server list with a relative link and a concise description.

## Required tests

Mock all provider calls. Automated tests must never require internet access or live Open-Meteo availability. At minimum, cover:

- every public input schema, defaults, mutually exclusive location modes, coordinate bounds, string limits, enum values, and hour/day/count limits;
- all documented weather-code groups plus an unknown code;
- location normalization, exact-match selection, one-result selection, ambiguity rejection, and no-result behavior;
- current, hourly, and daily response normalization, units, timezone metadata, attribution, null handling, and array alignment;
- requested hourly truncation and selection beginning at the current local hour using a fixed clock;
- timeout, network error, 429, other non-2xx responses, invalid JSON, and malformed upstream payloads;
- MCP server registration exposing exactly the four specified tools with valid structured results.

Use deterministic fixtures and clocks. Avoid snapshots where focused assertions make failures clearer.

## Completion requirements

Before finishing:

1. Run dependency installation if needed to create a valid lockfile.
2. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` inside `servers/weather`; fix every failure.
3. Perform a local MCP-level smoke test with the SDK client or MCP Inspector that launches the built STDIO server, lists tools, confirms exactly the four expected tools, and invokes tools against mocked or otherwise deterministic provider responses. Do not make successful live internet access a prerequisite for acceptance.
4. Inspect `git diff` and ensure only intended source, configuration, documentation, and lockfile changes are present. Do not commit `.env`, `node_modules`, logs, or `dist`.
5. Report the files created or changed, the implemented tool interface, verification commands and results, and any remaining caveats.

Do not stop after scaffolding or merely describe code. Implement the complete server, tests, documentation, root README update, and verification. Preserve unrelated user changes already present in the worktree.
