import { describe, expect, it, vi } from "vitest";

import { TrelloClient } from "../../src/clients/trelloClient.js";
import { TrelloApiError } from "../../src/utils/errors.js";

function clientWithResponse(response: Response): TrelloClient {
  return new TrelloClient({
    apiKey: "key",
    token: "token",
    baseUrl: "https://api.trello.test/1",
    fetchImpl: vi.fn(async () => response) as unknown as typeof fetch
  });
}

describe("TrelloClient API error mapping", () => {
  it("maps authentication failures", async () => {
    await expect(
      clientWithResponse(new Response("bad token", { status: 401 })).getBoard("board")
    ).rejects.toMatchObject({
      code: "TRELLO_AUTH_FAILED"
    });
  });

  it("maps rate limits", async () => {
    await expect(
      clientWithResponse(new Response("slow down", { status: 429 })).getBoard("board")
    ).rejects.toMatchObject({
      code: "TRELLO_RATE_LIMITED"
    });
  });

  it("redacts credentials from generic error bodies", async () => {
    await expect(
      clientWithResponse(
        new Response("https://x.test?key=secret&token=secret", { status: 400 })
      ).getBoard("board")
    ).rejects.toThrow(TrelloApiError);
  });
});
