import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config.js";
import { ConfigError } from "../../src/utils/errors.js";

describe("loadConfig", () => {
  it("validates required Trello environment variables", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });

  it("loads config and defaults the Trello API base URL", () => {
    const config = loadConfig({
      TRELLO_API_KEY: "key",
      TRELLO_TOKEN: "token",
      TRELLO_MAIN_BOARD_ID: "board"
    });

    expect(config).toEqual({
      trelloApiKey: "key",
      trelloToken: "token",
      trelloMainBoardId: "board",
      trelloApiBaseUrl: "https://api.trello.com/1"
    });
  });
});
