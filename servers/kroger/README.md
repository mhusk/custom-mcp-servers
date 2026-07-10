# Kroger MCP Server

Local STDIO MCP server for Kroger's public APIs. It can find Kroger-family stores, search and inspect products with store-specific price and aisle data, and add selected UPCs to an authenticated customer's cart.

## Security And Scope

- Credentials are read from environment variables only and are never accepted as MCP tool arguments.
- Tokens are sent only in the `Authorization` header and are never logged or included in public error details.
- `add_to_cart` is the only write tool. It cannot check out, place an order, remove items, or update cart quantities.
- The server does not refresh access tokens or implement an OAuth callback.
- STDOUT is reserved for MCP protocol messages; all logs go to STDERR.

## Prerequisites

- Node.js 22 or newer.
- npm.
- A Kroger developer application.
- A user-authorized OAuth access token with `product.compact` and `cart.basic:write` scopes.

Cart access requires Kroger's OAuth authorization-code grant. Generate the user-authorized token outside this server, then enter it in Codex Desktop. Kroger's official [public API documentation](https://www.postman.com/kroger/the-kroger-co-s-public-workspace/documentation/ki6utqb/kroger-public-apis) describes application registration and authorization.

## Environment Variables

```text
KROGER_ACCESS_TOKEN=your_user_authorized_access_token
KROGER_DEFAULT_LOCATION_ID=your_optional_default_location_id
KROGER_API_BASE_URL=https://api.kroger.com/v1
```

`KROGER_ACCESS_TOKEN` is required. `KROGER_DEFAULT_LOCATION_ID` is optional and supplies store context for price and aisle data when a product tool call does not include `locationId`. `KROGER_API_BASE_URL` is optional.

The server does not renew tokens. If Kroger returns 401 or 403, replace `KROGER_ACCESS_TOKEN` in Codex Desktop and restart or reconnect the MCP server.

## OAuth Token Helper

The included helper obtains an authorization-code token once, then uses the refresh token for later renewals. Register the exact local callback URL you choose in the Kroger developer application (for example, `http://127.0.0.1:3000/callback`). Keep the client secret and both tokens out of git and shell history.

Set these only in your shell or a secrets manager:

```bash
export KROGER_CLIENT_ID="..."
export KROGER_CLIENT_SECRET="..."
export KROGER_REDIRECT_URI="http://127.0.0.1:3000/callback"
```

The helper automatically reads `servers/kroger/.env` as well, so you can put those variables there instead. A variable already set in the shell takes precedence. To use a different file, set `KROGER_ENV_FILE=/absolute/path/to/file` before running the command. Keep `.env` out of git.

For initial customer consent, run the following and open the printed URL. The script validates OAuth state, receives the local callback, and prints an access token plus the refresh token when Kroger supplies one:

```bash
node scripts/kroger-oauth.mjs authorize
```

Save the printed `KROGER_ACCESS_TOKEN` and `KROGER_REFRESH_TOKEN` in Codex Desktop's Kroger MCP environment. When the access token expires, refresh it without signing in again:

```bash
node scripts/kroger-oauth.mjs refresh
```

Replace both saved values with the output after every refresh: OAuth providers may rotate refresh tokens. The default scopes are `product.compact cart.basic:write`; override them only during the initial authorization flow with `KROGER_OAUTH_SCOPES` if your Kroger app has different approved scopes.

## Install, Build, And Test

```bash
npm install
npm run build
npm test
npm run typecheck
npm run lint
```

Run the compiled server with:

```bash
npm start
```

The integration suite is read-only and runs only when both `KROGER_ACCESS_TOKEN` and `KROGER_DEFAULT_LOCATION_ID` are present:

```bash
npm run test:integration
```

It never calls the cart endpoint.

## Codex Desktop Registration

Use these MCP settings:

```text
Name: kroger
Transport: STDIO
Command: node
Arguments: dist/src/index.js
Working directory: /path/to/custom-mcp-servers/servers/kroger
```

Add `KROGER_ACCESS_TOKEN` to the MCP environment. Add `KROGER_DEFAULT_LOCATION_ID` if most product requests should use the same store.

## Tools

### `search_locations`

Find stores using exactly one origin form:

```json
{
  "zipCode": "48201",
  "radiusInMiles": 15,
  "limit": 10,
  "chain": "Kroger",
  "departments": ["01", "44"]
}
```

Alternatively provide `latLong`, or provide both `latitude` and `longitude`. Mixing origin forms or supplying only one coordinate returns a validation error.

### `get_location`

```json
{
  "locationId": "01800445"
}
```

Returns Kroger's complete location response, including address and departments when supplied by the API.

### `search_products`

```json
{
  "term": "whole milk",
  "locationId": "01800445",
  "brand": "Kroger",
  "fulfillment": ["csp"],
  "start": 0,
  "limit": 10
}
```

`term` is required. `locationId` overrides `KROGER_DEFAULT_LOCATION_ID`. Kroger only returns store-specific price and aisle data when a location is supplied.

### `get_product`

```json
{
  "id": "0001111040101",
  "locationId": "01800445"
}
```

`id` may be a Kroger product ID or UPC. `locationId` overrides the configured default.

### `add_to_cart`

```json
{
  "items": [
    {
      "upc": "0001111040101",
      "quantity": 2,
      "modality": "PICKUP"
    }
  ]
}
```

This write happens immediately. It sends all supplied items in one Kroger request and returns a normalized success result after Kroger responds with `204 No Content`. UPCs must be digit strings so leading zeros remain intact; quantity must be a positive integer; modality must be a non-empty Kroger-supported value.

## Errors

Tool errors are returned as JSON with stable `code` and `message` fields. Authentication errors explain how to replace an expired token. Rate-limit responses include Kroger's `Retry-After` value when present. Upstream response bodies are not exposed, preventing accidental credential disclosure.
