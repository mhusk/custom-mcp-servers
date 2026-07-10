import { z } from "zod";

import { ConfigError } from "./utils/errors.js";

export type AppConfig = {
  krogerAccessToken: string;
  krogerDefaultLocationId?: string;
  krogerApiBaseUrl: string;
};

const envSchema = z.object({
  KROGER_ACCESS_TOKEN: z.string().trim().min(1),
  KROGER_DEFAULT_LOCATION_ID: z.string().trim().min(1).optional(),
  KROGER_API_BASE_URL: z.string().trim().url().default("https://api.kroger.com/v1")
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const invalid = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new ConfigError(`Missing or invalid required environment variable(s): ${invalid}`);
  }

  return {
    krogerAccessToken: parsed.data.KROGER_ACCESS_TOKEN,
    ...(parsed.data.KROGER_DEFAULT_LOCATION_ID === undefined
      ? {}
      : { krogerDefaultLocationId: parsed.data.KROGER_DEFAULT_LOCATION_ID }),
    krogerApiBaseUrl: parsed.data.KROGER_API_BASE_URL.replace(/\/+$/, "")
  };
}
