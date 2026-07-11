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

  it("removes trailing slashes from a custom Trello API base URL", () => {
    const config = loadConfig({
      TRELLO_API_KEY: "key",
      TRELLO_TOKEN: "token",
      TRELLO_MAIN_BOARD_ID: "board",
      TRELLO_API_BASE_URL: "https://api.trello.test/1///"
    });

    expect(config.trelloApiBaseUrl).toBe("https://api.trello.test/1");
  });
});
