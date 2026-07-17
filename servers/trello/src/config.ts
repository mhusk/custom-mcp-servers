import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

import { ConfigError } from "./utils/errors.js";

export type BoardRegistryEntry = {
  id: string;
  name: string;
};

export type AppConfig = {
  trelloApiKey: string;
  trelloToken: string;
  boardRegistry: Record<string, BoardRegistryEntry>;
  allowedBoardIds: string[];
  trelloMainBoardId: string;
  trelloApiBaseUrl: string;
  promotionStorePath: string;
};

const envSchema = z.object({
  TRELLO_API_KEY: z.string().trim().min(1),
  TRELLO_TOKEN: z.string().trim().min(1),
  TRELLO_MAIN_BOARD_ID: z.string().trim().min(1).optional(),
  TRELLO_STAGING_BOARD_ID: z.string().trim().min(1).optional(),
  TRELLO_BOARD_REGISTRY: z.string().trim().min(1).optional(),
  TRELLO_BOARD_REGISTRY_FILE: z.string().trim().min(1).optional(),
  TRELLO_ALLOWED_BOARD_IDS: z.string().trim().min(1).optional(),
  TRELLO_PROMOTION_STORE_PATH: z.string().trim().min(1).optional(),
  TRELLO_API_BASE_URL: z.string().trim().url().default("https://api.trello.com/1")
});

const registrySchema = z.record(
  z.string().trim().min(1),
  z.union([
    z
      .string()
      .trim()
      .min(1)
      .transform((id) => ({ id, name: "" })),
    z.object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1)
    })
  ])
);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new ConfigError(`Missing or invalid required environment variable(s): ${missing}`);
  }

  const boardRegistry = loadBoardRegistry(parsed.data);
  const main = boardRegistry.main;
  if (!main) {
    throw new ConfigError('The board registry must contain a "main" alias.');
  }

  const allowedBoardIds = parseAllowlist(parsed.data.TRELLO_ALLOWED_BOARD_IDS, boardRegistry);
  if (!allowedBoardIds.includes(main.id)) {
    throw new ConfigError('The "main" board ID must be present in TRELLO_ALLOWED_BOARD_IDS.');
  }

  return {
    trelloApiKey: parsed.data.TRELLO_API_KEY,
    trelloToken: parsed.data.TRELLO_TOKEN,
    boardRegistry,
    allowedBoardIds,
    trelloMainBoardId: main.id,
    trelloApiBaseUrl: parsed.data.TRELLO_API_BASE_URL.replace(/\/+$/, ""),
    promotionStorePath: resolve(
      parsed.data.TRELLO_PROMOTION_STORE_PATH ?? ".trello-promotion-idempotency.json"
    )
  };
}

function loadBoardRegistry(data: z.infer<typeof envSchema>): Record<string, BoardRegistryEntry> {
  if (data.TRELLO_BOARD_REGISTRY && data.TRELLO_BOARD_REGISTRY_FILE) {
    throw new ConfigError("Set only one of TRELLO_BOARD_REGISTRY or TRELLO_BOARD_REGISTRY_FILE.");
  }

  let raw: unknown;
  try {
    if (data.TRELLO_BOARD_REGISTRY) {
      raw = JSON.parse(data.TRELLO_BOARD_REGISTRY);
    } else if (data.TRELLO_BOARD_REGISTRY_FILE) {
      raw = JSON.parse(readFileSync(resolve(data.TRELLO_BOARD_REGISTRY_FILE), "utf8"));
    } else if (data.TRELLO_MAIN_BOARD_ID) {
      raw = {
        main: { id: data.TRELLO_MAIN_BOARD_ID, name: "Main board" },
        ...(data.TRELLO_STAGING_BOARD_ID
          ? {
              staging: {
                id: data.TRELLO_STAGING_BOARD_ID,
                name: "Staging board"
              }
            }
          : {})
      };
    } else {
      throw new ConfigError(
        "Set TRELLO_BOARD_REGISTRY, TRELLO_BOARD_REGISTRY_FILE, or legacy TRELLO_MAIN_BOARD_ID."
      );
    }
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError("The Trello board registry is not valid readable JSON.");
  }

  const result = registrySchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError("The Trello board registry must map aliases to actual board IDs.");
  }
  return result.data;
}

function parseAllowlist(
  raw: string | undefined,
  registry: Record<string, BoardRegistryEntry>
): string[] {
  // Legacy single-board installations remain valid. Multi-board installations must set an
  // explicit allowlist so merely adding an entry to the registry cannot grant access.
  if (!raw) {
    const aliases = Object.keys(registry);
    if (aliases.length === 1 && aliases[0] === "main") {
      return [registry.main!.id];
    }
    throw new ConfigError("TRELLO_ALLOWED_BOARD_IDS is required for a multi-board registry.");
  }

  const ids = [
    ...new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ];
  if (ids.length === 0) {
    throw new ConfigError("TRELLO_ALLOWED_BOARD_IDS must contain at least one board ID.");
  }
  return ids;
}
