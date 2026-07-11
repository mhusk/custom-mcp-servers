import { z } from "zod";

import { ConfigError } from "./utils/errors.js";

export type AppConfig = {
  trelloApiKey: string;
  trelloToken: string;
  trelloMainBoardId: string;
  trelloApiBaseUrl: string;
};

const envSchema = z.object({
  TRELLO_API_KEY: z.string().trim().min(1),
  TRELLO_TOKEN: z.string().trim().min(1),
  TRELLO_MAIN_BOARD_ID: z.string().trim().min(1),
  TRELLO_API_BASE_URL: z.string().trim().url().default("https://api.trello.com/1")
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new ConfigError(`Missing or invalid required environment variable(s): ${missing}`);
  }

  return {
    trelloApiKey: parsed.data.TRELLO_API_KEY,
    trelloToken: parsed.data.TRELLO_TOKEN,
    trelloMainBoardId: parsed.data.TRELLO_MAIN_BOARD_ID,
    trelloApiBaseUrl: parsed.data.TRELLO_API_BASE_URL.replace(/\/+$/, "")
  };
}
