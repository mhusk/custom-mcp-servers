import { describe, expect, it, vi } from "vitest";

import { CardService } from "../../src/services/cardService.js";
import { NotFoundError } from "../../src/utils/errors.js";

describe("CardService cross-board rejection", () => {
  it("rejects card details for cards outside the configured board", async () => {
    const client = {
      getCard: vi.fn(async () => ({
        id: "card-1",
        idBoard: "other-board",
        idList: "list-1",
        name: "Build thing",
        desc: "",
        url: "https://example.com",
        due: null,
        dueComplete: false,
        dateLastActivity: "2026-07-09T00:00:00.000Z",
        pos: 1
      })),
      getCardComments: vi.fn()
    };
    const boardService = {
      getLists: vi.fn(async () => [{ id: "list-1", name: "To Do", closed: false, pos: 1 }]),
      getCustomFieldDefinitions: vi.fn(async () => [])
    };

    const service = new CardService(client as never, boardService as never, "main-board");

    await expect(service.getCardDetails("card-1")).rejects.toThrow(NotFoundError);
  });
});
