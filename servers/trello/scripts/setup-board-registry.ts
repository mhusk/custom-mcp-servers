import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { TrelloClient } from "../src/clients/trelloClient.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const apiKey = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_TOKEN;
const mainId = argument("--main-id") ?? process.env.TRELLO_MAIN_BOARD_ID;
const stagingShortLink = argument("--staging-short-link");
const outputPath = resolve(argument("--output") ?? "board-registry.json");

if (!apiKey || !token || !mainId || !stagingShortLink) {
  throw new Error(
    "Usage: npm run setup:boards -- --main-id <actual-id> --staging-short-link <short-link> [--output board-registry.json]; TRELLO_API_KEY and TRELLO_TOKEN are required."
  );
}

const client = new TrelloClient({
  apiKey,
  token,
  baseUrl: (process.env.TRELLO_API_BASE_URL ?? "https://api.trello.com/1").replace(/\/+$/, "")
});

const [main, staging] = await Promise.all([
  client.getBoard(mainId),
  client.getBoard(stagingShortLink)
]);

// Only actual IDs returned by Trello are persisted. The staging short link is setup input only and
// is never saved as an operational board identifier.
const registry = {
  main: { id: main.id, name: main.name },
  staging: { id: staging.id, name: staging.name }
};
await writeFile(outputPath, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
process.stderr.write(
  `Wrote ${outputPath}. Set TRELLO_ALLOWED_BOARD_IDS=${main.id},${staging.id}\n`
);
