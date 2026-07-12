# Custom MCP Servers

Local STDIO MCP servers for Codex Desktop and other MCP-compatible clients. Each server is an independent Node.js package with its own dependencies, build, tests, and configuration.

## Servers

- [Trello](servers/trello/README.md) — scoped Trello board visibility and selected card mutations.
- [Kroger](servers/kroger/README.md) — Kroger store discovery, product search and details, and additions to an authenticated customer's cart.
- [Weather](servers/weather/README.md) — read-only global location search and current, hourly, and daily forecasts from Open-Meteo.

Credentials, when required by a server, are supplied through environment variables. Never commit real credentials or tokens.
