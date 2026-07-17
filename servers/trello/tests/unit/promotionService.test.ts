import { describe, expect, it, vi } from "vitest";

import { PromotionService } from "../../src/services/promotionService.js";
import { MemoryPromotionStore } from "../../src/services/promotionStore.js";
import type { NormalizedCard } from "../../src/types/trello.js";

function source(listName = "Ready to Transfer"): NormalizedCard {
  return {
    id: "staging-card",
    title: "Send proposal",
    url: "https://trello/staging-card",
    status: "other",
    list: { id: "ready", name: listName },
    description:
      "PRIVATE EMAIL BODY\n\n## Task Summary\nSend approved proposal.\n\n## Intended Outcome\nSigned agreement.",
    dueDate: "2026-08-01T00:00:00.000Z",
    dueComplete: false,
    labels: [],
    customFields: [],
    checklists: [],
    attachments: [],
    comments: [],
    lastActivityAt: "2026-07-16T00:00:00.000Z",
    position: 1
  };
}

function fixture(listName = "Ready to Transfer") {
  const boardService = {
    resolveBoard: vi.fn((board: string) => ({
      alias: board,
      id: board === "main" ? "main-board" : "staging-board",
      name: board
    })),
    getList: vi.fn(async () => ({ id: "main-list", name: "To Do", closed: false, pos: 1 })),
    getListByName: vi.fn(async (name: string) => ({
      id: name === "Transferred / Logged" ? "transferred" : "errors",
      name,
      closed: false,
      pos: 1
    }))
  };
  const cardService = { getCardDetails: vi.fn(async () => source(listName)) };
  const writeService = {
    createCardOnBoard: vi.fn(async (_board: string, _input: { description: string }) => ({
      boardId: "main-board",
      listId: "main-list",
      cardId: "main-card",
      url: "https://trello/main-card"
    })),
    addComment: vi.fn(async () => ({})),
    moveCardWithinBoard: vi.fn(async () => ({}))
  };
  const service = new PromotionService(
    boardService as never,
    cardService as never,
    writeService as never,
    new MemoryPromotionStore()
  );
  return { boardService, cardService, writeService, service };
}

const input = {
  stagingCardId: "staging-card",
  destinationBoard: "main" as const,
  destinationListId: "main-list",
  idempotencyKey: "promotion-1"
};

describe("PromotionService", () => {
  it("promotes a sanitized copy and logs the staging card", async () => {
    const { service, writeService } = fixture();
    const result = await service.promote(input);

    expect(result).toMatchObject({ cardId: "main-card", idempotentReplay: false });
    expect(writeService.createCardOnBoard).toHaveBeenCalledWith(
      "main",
      expect.objectContaining({
        listId: "main-list",
        name: "Send proposal",
        due: "2026-08-01T00:00:00.000Z",
        description: expect.stringContaining("Send approved proposal.")
      })
    );
    const description = writeService.createCardOnBoard.mock.calls[0]![1].description;
    expect(description).toContain("Signed agreement.");
    expect(description).toContain("https://trello/staging-card");
    expect(description).not.toContain("PRIVATE EMAIL BODY");
    expect(writeService.addComment).toHaveBeenCalledWith(
      "staging-card",
      "Promoted task: https://trello/main-card",
      "staging"
    );
    expect(writeService.moveCardWithinBoard).toHaveBeenCalledWith(
      "staging",
      "staging-card",
      "transferred"
    );
  });

  it("returns the same card for a repeated idempotency key", async () => {
    const { service, writeService } = fixture();
    await service.promote(input);
    const replay = await service.promote(input);

    expect(replay).toMatchObject({ cardId: "main-card", idempotentReplay: true });
    expect(writeService.createCardOnBoard).toHaveBeenCalledTimes(1);
  });

  it("rejects promotion unless an operator placed the card in Ready to Transfer", async () => {
    const { service, writeService } = fixture("Email Review");
    await expect(service.promote(input)).rejects.toMatchObject({
      code: "TRELLO_PROMOTION_NOT_APPROVED"
    });
    expect(writeService.createCardOnBoard).not.toHaveBeenCalled();
    expect(writeService.moveCardWithinBoard).not.toHaveBeenCalled();
  });

  it("moves an approved source to Errors / Needs Review when creation fails", async () => {
    const { service, writeService } = fixture();
    writeService.createCardOnBoard.mockRejectedValueOnce(new Error("Trello unavailable"));

    await expect(service.promote(input)).rejects.toThrow("Trello unavailable");
    expect(writeService.moveCardWithinBoard).toHaveBeenCalledWith(
      "staging",
      "staging-card",
      "errors"
    );
  });
});
