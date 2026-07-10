# Trello MCP Server

Read-only local MCP server for one configured Trello board. Version 1 is designed to give Codex, or another MCP-capable AI assistant, reliable visibility into a personal work queue without allowing any Trello mutations.

## Version 1 Scope

This server focuses on the primary board configured by `TRELLO_MAIN_BOARD_ID`, especially the `Back-Log` and `To-Do` lists. It can read board metadata, lists, labels, custom fields, cards, checklists, checklist item due dates, due dates, comments, and attachments.

It intentionally does not include create, update, move, archive, delete, comment-writing, checklist mutation, or generic Trello API tools.

## Security And Read-Only Guarantees

- Only `GET` requests are implemented in the Trello client.
- Trello credentials are read from environment variables only.
- Credentials are never accepted through MCP tool arguments.
- Credentials are not logged, committed, or shown in README examples.
- `.env` is ignored by git.
- Card details are returned only after validating the card belongs to the configured board.
- There is no arbitrary Trello request tool.

## Prerequisites

- Node.js 22 or newer.
- npm.
- A Trello API key, token, and board ID for the board you want to inspect.

## Trello API Key And Token

1. Visit [https://trello.com/power-ups/admin](https://trello.com/power-ups/admin).
2. Create or open a Power-Up, then copy its API key.
3. Generate a token for your account from Trello's API key page.
4. Keep both values private.

Use the board ID from the Trello board URL or Trello API response. Do not use list IDs in configuration; the server discovers lists by name.

## Environment Setup

Export these variables in your shell, pass them through from Codex, or load them with a tool such as `node --env-file=.env`:

```bash
TRELLO_API_KEY=your_trello_api_key
TRELLO_TOKEN=your_trello_token
TRELLO_MAIN_BOARD_ID=your_trello_board_id
TRELLO_API_BASE_URL=https://api.trello.com/1
```

`TRELLO_API_BASE_URL` is optional and defaults to `https://api.trello.com/1`. The `.env.example` file is a placeholder reference only; do not commit real secrets.

## Installation

```bash
npm install
```

## Build And Run

```bash
npm run build
npm run start
```

For local development:

```bash
npm run dev
```

Because this is an STDIO MCP server, logs go to stderr only. Stdout is reserved for MCP protocol messages.

## Codex Desktop Registration

Name:

```text
trello
```

Transport:

```text
STDIO
```

Command:

```text
node
```

Arguments:

```text
dist/src/index.js
```

Working directory:

```text
/Users/michaelhuskey/Code/custom-mcp-servers/servers/trello
```

Environment variable passthrough:

```text
TRELLO_API_KEY
TRELLO_TOKEN
TRELLO_MAIN_BOARD_ID
```

You may enter environment-variable values directly in Codex, but passthrough is preferable when the variables are already configured securely on the machine.

## MCP Tools

### `get_board_overview`

Input:

```json
{}
```

Returns the board ID, name, URL, available lists, open-card count for each list, labels, and custom field definitions. Archived cards are not included in card counts.

### `get_cards_in_list`

Input:

```json
{
  "listName": "To-Do",
  "includeComments": false,
  "includeAttachments": true
}
```

Returns all open cards in the requested list using the normalized card model. List matching is case-insensitive and trims whitespace. If the list is missing, the error includes available list names.

### `get_work_queue`

Input:

```json
{
  "includeBacklog": true,
  "includeTodo": true
}
```

Preferred entry point for understanding available work. Returns `WorkItem` records from `Back-Log` and `To-Do`, sorted by overdue cards first, earliest due dates next, cards without due dates after that, and Trello card position within each group.

### `get_card_details`

Input:

```json
{
  "cardId": "trello_card_id",
  "includeComments": true,
  "includeAttachments": true
}
```

Returns a full normalized card. Use this after reviewing the work queue when you need deeper inspection. The server rejects cards that do not belong to the configured main board.

### `search_cards`

Input:

```json
{
  "query": "invoice",
  "lists": ["Back-Log", "To-Do", "Blocked", "Done"],
  "limit": 20
}
```

Searches card titles and descriptions locally after retrieving cards from the configured board. Matching is case-insensitive substring matching. Title matches rank ahead of description-only matches. `limit` is capped at 100.

### `get_due_soon`

Input:

```json
{
  "days": 7,
  "lists": ["Back-Log", "To-Do"]
}
```

Returns incomplete cards due between the current UTC time and the end of the requested day window. The calculation uses UTC milliseconds from the server clock.

### `get_overdue_cards`

Input:

```json
{
  "lists": ["Back-Log", "To-Do", "Blocked"]
}
```

Returns cards whose due date is before the current server time and whose `dueComplete` value is false.

### `find_underdefined_cards`

Input:

```json
{
  "lists": ["Back-Log", "To-Do"],
  "minimumDescriptionLength": 40
}
```

Uses deterministic local rules only. It flags missing or short descriptions, vague titles, missing title action verbs, multi-step descriptions without checklists, empty custom fields, and missing due dates. Missing due dates are informational because backlog items often do not need dates.

Completeness score starts at 100. Each warning subtracts 15 points and each info issue subtracts 5 points, clamped between 0 and 100.

## Example Codex Questions

- "What should I work on next from Trello?"
- "Show my overdue Back-Log and To-Do cards."
- "Which To-Do cards are underdefined?"
- "Search Trello for cards about invoices."
- "Open the details for this Trello card ID."

## Testing

```bash
npm run typecheck
npm run lint
npm run test
npm run test:integration
```

Unit tests mock network requests. Integration tests are read-only and run only when `TRELLO_API_KEY`, `TRELLO_TOKEN`, and `TRELLO_MAIN_BOARD_ID` are present.

## Troubleshooting

- Missing environment variables: set `TRELLO_API_KEY`, `TRELLO_TOKEN`, and `TRELLO_MAIN_BOARD_ID`.
- Authentication failure: regenerate the Trello token and confirm it matches the API key.
- Invalid board ID: confirm `TRELLO_MAIN_BOARD_ID` is the ID for the board you intend to inspect.
- Missing list: confirm the board has the expected list name. Matching is case-insensitive and trims whitespace.
- Rate limited: wait and retry after Trello's rate-limit window.
- No Codex response: ensure the command is `node`, arguments are `dist/src/index.js`, and the working directory is this package directory.

## Future Roadmap

- Better work prioritization signals.
- Optional label and custom-field filters.
- Richer recurring-card insight for `Repeat Cards`.
- Template-card discovery for planning workflows.
- Additional read-only sources mapped into the generic `WorkItem` abstraction.
