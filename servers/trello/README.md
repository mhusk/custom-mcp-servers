# Multi-Board Trello MCP Server

A local MCP server that gives Codex or another MCP client scoped read/write access to explicitly approved Trello boards.

The server uses two independent configuration controls:

1. A board registry maps friendly aliases such as `main`, `staging`, or `team` to actual Trello board IDs.
2. An allowlist specifies which registered board IDs may be accessed.

A board must be both registered and allowlisted. MCP callers cannot discover or access arbitrary boards, and there is no generic Trello request tool.

## Features

- Read board metadata, lists, labels, custom fields, cards, comments, and attachments.
- Select boards by registered alias or validated board ID.
- Resolve list names independently on each board.
- Reject missing or ambiguous list, label, and custom-field lookups.
- Create cards only on the configured `staging` board.
- Update descriptions, comments, custom fields, labels, checklists, and card locations on allowed boards.
- Optionally promote an operator-approved staging card to `main` using a sanitized copy and persistent idempotency protection.
- Preserve the original single-board behavior: read tools without a `board` argument default to `main`.

## Prerequisites

- Node.js 22 or newer.
- npm.
- A Trello API key and token with access to the boards you intend to register.
- The actual Trello ID of the board that will use the `main` alias.
- The actual Trello IDs of every board you want the MCP to access.

## Install And Test

```bash
git clone <repository-url>
cd custom-mcp-servers/servers/trello
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

The built MCP entry point is `dist/src/index.js`.

## Trello Credentials

1. Open [Trello Power-Up Admin](https://trello.com/power-ups/admin).
2. Create or open a Power-Up and copy its API key.
3. Generate a Trello token for the account that owns or can access the approved boards.
4. Keep both values private. Never commit them or paste them into a public issue or task.

The MCP server narrows access at the application layer. It does not grant Trello permissions that the token does not already have.

## Create A Board Registry

If you already know the board IDs, create `board-registry.json` manually. The keys are friendly aliases used in tool calls. The `name` values are display labels and do not need to match Trello exactly.

```json
{
  "main": {
    "id": "actual_main_board_id",
    "name": "Primary work board"
  },
  "staging": {
    "id": "actual_staging_board_id",
    "name": "Automation staging board"
  },
  "team": {
    "id": "actual_team_board_id",
    "name": "Team board"
  }
}
```

The `main` alias is required because existing read tools default to it. The `staging` alias is required only for staging-only card creation or the optional promotion workflow. Other aliases can be named however you prefer.

### Optional: Resolve A Short Link

You do not need the setup helper when you already have actual board IDs. If you have a staging-board short link instead of its ID, the helper can resolve it through Trello:

```bash
export TRELLO_API_KEY='your_api_key'
export TRELLO_TOKEN='your_trello_token'

npm run setup:boards -- \
  --main-id ACTUAL_MAIN_BOARD_ID \
  --staging-short-link STAGING_BOARD_SHORT_LINK \
  --output board-registry.json
```

`--output board-registry.json` means “save the generated registry in a file named `board-registry.json` in the current directory.” It does not send the registry anywhere. Only actual board IDs returned by Trello are written; the short link is not used for later operations.

Protect the file and do not commit it if board names or IDs are private:

```bash
chmod 600 board-registry.json
```

`board-registry.json` is ignored by this package's `.gitignore`.

## Configure The Environment

Create a private `.env` file in this package directory:

```dotenv
TRELLO_API_KEY=your_api_key
TRELLO_TOKEN=your_trello_token
TRELLO_BOARD_REGISTRY_FILE=./board-registry.json
TRELLO_ALLOWED_BOARD_IDS=actual_main_board_id,actual_staging_board_id,actual_team_board_id
```

Then protect it:

```bash
chmod 600 .env
```

Configuration notes:

- `TRELLO_BOARD_REGISTRY_FILE` points to the registry JSON file.
- `TRELLO_BOARD_REGISTRY` may contain the registry as inline JSON instead. Do not set both variables.
- `TRELLO_ALLOWED_BOARD_IDS` is a separate comma-separated allowlist. Adding a registry entry alone does not grant access.
- `TRELLO_PROMOTION_STORE_PATH` is optional. It selects the local JSON file used by `promote_staging_task` to remember which idempotency keys have already created destination cards. This prevents a timeout or retry from creating the same card twice. If omitted, it defaults to `./.trello-promotion-idempotency.json`. The file is created only when promotion is used; installations that never use promotion can ignore this setting.
- `TRELLO_API_BASE_URL` is optional and defaults to Trello's standard API endpoint.
- `.env`, `board-registry.json`, and the default promotion store are ignored by git.

For backward compatibility, a main-only installation may use `TRELLO_MAIN_BOARD_ID`. Multi-board installations should use a registry and explicit allowlist.

## Register With Codex Desktop

First build the server and obtain absolute paths:

```bash
npm run build
command -v node
pwd
```

Register the stdio server with the Codex CLI. Replace the placeholders with the values returned above:

```bash
codex mcp add trello-multiboard -- \
  /ABSOLUTE/PATH/TO/node \
  --env-file=/ABSOLUTE/PATH/TO/servers/trello/.env \
  /ABSOLUTE/PATH/TO/servers/trello/dist/src/index.js
```

Using `--env-file` keeps Trello credentials out of the MCP command configuration.

If you register the server through the Codex desktop settings UI, use the equivalent values:

| Setting    | Value                                                |
| ---------- | ---------------------------------------------------- |
| Name       | `trello-multiboard`                                  |
| Transport  | `STDIO`                                              |
| Command    | Absolute path returned by `command -v node`          |
| Argument 1 | `--env-file=/absolute/path/to/servers/trello/.env`   |
| Argument 2 | `/absolute/path/to/servers/trello/dist/src/index.js` |

All paths should be absolute. Fully quit and reopen the Codex desktop app after changing MCP configuration.

## Validate The Connection

Check the saved registration:

```bash
codex mcp list --json
```

Look for an enabled entry named `trello-multiboard` with the expected command and arguments.

In a new Codex task, ask:

```text
Use the Trello MCP list_allowed_boards tool. Show the alias, board ID, and configured name for every result. Do not perform writes.
```

Expected result: only registry entries whose IDs are also present in `TRELLO_ALLOWED_BOARD_IDS`.

### Why There Is No Account-Wide Board Search Tool

`list_allowed_boards()` is the MCP's board-discovery tool. It returns all boards this server is approved to use and nothing else.

The Trello token may be able to see additional personal, private, or organization boards. An MCP tool that queried every board visible to that token would let a caller enumerate boards outside the configured allowlist. That would defeat this server's primary security boundary, so account-wide discovery is intentionally not exposed to MCP callers.

If an operator wants to add another board, obtain its ID in Trello, add it to the registry and allowlist, restart the server, and then confirm it appears in `list_allowed_boards()`.

Validate the backward-compatible default:

```text
Use get_board_overview without a board argument. Do not perform writes. Confirm which registered alias and board ID were selected.
```

Expected result: the board registered as `main`.

Validate a second board:

```text
Use get_board_overview with board set to staging. Do not perform writes. Return the board ID and open lists in order.
```

Expected result: the board ID registered under `staging`. List IDs must be different from list IDs on other boards even when list names match.

## Optional Write Validation

The following check creates a real card on the staging board. Choose a disposable staging list and clean up manually afterward.

```text
Using the Trello MCP, create a staging card in the list named "Test" with the title "MCP validation — safe to delete" and description "Created during validation." Read it back, update its description, and add a short validation comment. Do not promote it or write to another board. Return the board ID, list ID, card ID, and URL from every write.
```

Verify that:

- Every response contains the staging board ID.
- The reported list ID belongs to that staging board.
- `get_card_details` returns the updated content.
- No card was created on another board.

This MCP intentionally has no generic delete or archive tool. Remove the validation card manually in Trello.

## Tools

### Board And Card Reads

- `list_allowed_boards({})`
- `get_board_overview({ board? })`
- `get_cards_in_list({ board?, listId or listName, includeComments?, includeAttachments? })`
- `get_card_details({ board?, cardId, includeComments?, includeAttachments? })`

The `board` argument defaults to `main` on existing read tools. It may be a registered alias or registered board ID, but the resolved ID must be allowlisted.

### Writes

- `create_list({ board: "staging", name, position? })`
- `create_card({ board: "staging", listId or listName, name, description, due?, labels?, customFields? })`
- `update_card_description({ board?, cardId, description })`
- `move_card_within_board({ board?, cardId, destinationListId })`
- `add_card_comment({ board?, cardId, text })`
- `update_card_custom_field({ board?, cardId, customFieldId, value })`
- `create_card_checklist({ board?, cardId, name })`
- `add_checklist_item({ board?, cardId, checklistId, name })`
- `add_card_label({ board?, cardId, labelId })`
- `remove_card_label({ board?, cardId, labelId })`

Card creation is deliberately limited to `staging`. Other writes validate the selected board, card, and referenced board-local resource before making a change.

Write responses include `boardId`, `listId`, `cardId`, and `url`. List creation returns `cardId: null` because it does not affect a card.

### Optional Staging Promotion Workflow

The server includes:

```text
promote_staging_task({
  stagingCardId,
  destinationBoard: "main",
  destinationListId,
  idempotencyKey
})
```

This opinionated workflow is optional. It expects the staging board to contain these exact open list names:

- `Ready to Transfer`
- `Transferred / Logged`
- `Errors / Needs Review`

Promotion behavior:

1. An operator manually moves a staging card to `Ready to Transfer`.
2. The tool validates the destination list on the `main` board.
3. It creates a new destination card instead of moving the original card across boards.
4. It copies only the title, task summary, due date, intended outcome, and source link.
5. It links the new card from the staging card and moves the source to `Transferred / Logged`.
6. A persistent idempotency key prevents retries from creating another destination card.
7. Failures after approval are moved to `Errors / Needs Review` when possible.

Task summary and intended outcome may be supplied through custom fields with those names or matching Markdown headings in the staging description. Other description content, comments, attachments, labels, and reply text are not copied.

## Safety Model

- Every selected board is resolved through the registry and checked against the allowlist.
- List IDs are resolved and validated on the selected board; IDs are never reused across boards by name.
- Missing or ambiguous board-local resources fail without fallback.
- Scheduled jobs may create cards only on `staging`.
- List creation is reserved for an explicit operator action and should never be scheduled.
- The server exposes no board creation, rename, archive, or delete operations.
- Promotion requires a manual list move as its approval gate.
- Generic logs contain public error codes and identifiers, not raw email bodies or full reply text.

## Add Another Allowed Board

No code changes are required for general read access or existing card-write tools:

1. Obtain the board's actual Trello ID.
2. Add a unique alias and `{ "id", "name" }` entry to the registry.
3. Add the exact ID to `TRELLO_ALLOWED_BOARD_IDS`.
4. Restart the MCP server or Codex desktop app.
5. Call `list_allowed_boards` and `get_board_overview` with the new alias.

Staging-only card creation and staging-to-main promotion remain intentionally bound to the `staging` and `main` aliases.

## Development Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx prettier --check .
```

Unit tests mock Trello network requests. The read-only integration test runs only when Trello credentials and a main-board ID are available.

## Troubleshooting

- `CONFIG_ERROR`: check the registry path, JSON syntax, `main` entry, and allowlist.
- `TRELLO_BOARD_ACCESS_DENIED`: the board is not both registered and allowlisted.
- `TRELLO_LIST_NOT_FOUND`: inspect the selected board and use a list ID from that board.
- `TRELLO_LIST_AMBIGUOUS`: remove duplicate names or select the list by ID.
- `TRELLO_CARD_WRONG_BOARD`: the card does not belong to the selected board.
- `TRELLO_PROMOTION_NOT_APPROVED`: an operator must move the source card to `Ready to Transfer`.
- `TRELLO_IDEMPOTENCY_CONFLICT`: the key was already used with different promotion parameters.
- MCP does not appear in Codex: rebuild, run `codex mcp list --json`, verify absolute paths, and restart Codex.

This is an stdio MCP server. Protocol messages use stdout; sanitized operational logs use stderr.
