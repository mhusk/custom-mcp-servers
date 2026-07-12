# Weather MCP server

A focused, read-only STDIO MCP server for global place search and weather forecasts from Open-Meteo. It requires no API key, signup, or credentials.

## Prerequisites and setup

Use Node.js 22 or newer.

```sh
cd /absolute/path/to/custom-mcp-servers/servers/weather
npm install
npm run build
npm start
```

Development and validation commands are `npm run dev`, `npm run typecheck`, `npm run lint`, `npm run format`, `npm test`, `npm run test:watch`, and `npm run test:smoke`.

## Tools

- `search_locations`: `{ "query": "Detroit, MI", "count": 5, "language": "en" }`
- `get_current_weather`: `{ "query": "Detroit, MI", "temperatureUnit": "fahrenheit", "windSpeedUnit": "mph" }`
- `get_hourly_forecast`: `{ "latitude": 42.3314, "longitude": -83.0458, "hours": 24 }`
- `get_daily_forecast`: `{ "query": "Paris, France", "days": 7 }`

Weather calls accept either a 2–100 character place query or both latitude and longitude, never both modes. Temperature units are `celsius` (default) or `fahrenheit`; wind units are `kmh` (default), `mph`, `ms`, or `kn`. Search count is 1–10 (default 5), hourly range is 1–168 (default 24), and daily range is 1–16 (default 7). Results include structured content plus JSON text for text-oriented MCP clients.

Queries that have several plausible matches fail safely and list up to five candidates; retry with coordinates. Other actionable errors distinguish no matches, provider timeouts/network failures, rate limiting, HTTP failures, invalid JSON, malformed payloads, and inconsistent time-series arrays. Diagnostics go only to stderr.

## Optional configuration

Copy `.env.example` values into the MCP client's environment only when overrides are needed:

- `OPEN_METEO_GEOCODING_BASE_URL` (default `https://geocoding-api.open-meteo.com/v1`)
- `OPEN_METEO_FORECAST_BASE_URL` (default `https://api.open-meteo.com/v1`)
- `OPEN_METEO_TIMEOUT_MS` (default `10000`, allowed `1000`–`60000`)

No credential variable exists. Base URL overrides make deterministic local tests possible.

## Codex Desktop registration

- Name: `weather`
- Transport: `STDIO`
- Command: `node`
- Arguments: `dist/src/index.js`
- Working directory: `/absolute/path/to/custom-mcp-servers/servers/weather`

Build before registration. The working directory may be any user-supplied absolute path ending at this package.

## Provider terms and attribution

Every successful result includes `Weather data by Open-Meteo.com` and `https://open-meteo.com/`. This server uses Open-Meteo's hosted free API for personal, non-commercial use. It is best-effort infrastructure with no uptime guarantee and a current fair-use limit of 10,000 calls per day. Review [Open-Meteo](https://open-meteo.com/) for current terms before broader use.

The server intentionally does not expose arbitrary fetching, historical weather, alerts, air quality, marine, radar, river, or wildfire data.
