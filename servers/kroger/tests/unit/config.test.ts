import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config.js";
import { ConfigError } from "../../src/utils/errors.js";

describe("loadConfig", () => {
  it("requires a non-empty access token", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({ KROGER_ACCESS_TOKEN: " " })).toThrow(ConfigError);
  });

  it("loads defaults and optional location", () => {
    expect(loadConfig({ KROGER_ACCESS_TOKEN: "secret" })).toEqual({
      krogerAccessToken: "secret",
      krogerApiBaseUrl: "https://api.kroger.com/v1"
    });

    expect(
      loadConfig({
        KROGER_ACCESS_TOKEN: "secret",
        KROGER_DEFAULT_LOCATION_ID: "store-1",
        KROGER_API_BASE_URL: "https://api.kroger.test/v1///"
      })
    ).toEqual({
      krogerAccessToken: "secret",
      krogerDefaultLocationId: "store-1",
      krogerApiBaseUrl: "https://api.kroger.test/v1"
    });
  });
});
