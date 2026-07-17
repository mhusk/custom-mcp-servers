import { describe, expect, it, vi } from "vitest";

import { BoardRegistry } from "../../src/services/boardRegistry.js";
import { BoardService } from "../../src/services/boardService.js";
import { CardService } from "../../src/services/cardService.js";
import { WriteService } from "../../src/services/writeService.js";
import type { NormalizedCard, TrelloCard } from "../../src/types/trello.js";

const registry = new BoardRegistry(
  {
    main: { id: "main-board", name: "Main" },
    staging: { id: "staging-board", name: "Staging" },
    hidden: { id: "hidden-board", name: "Hidden" }
  },
  ["main-board", "staging-board"]
);

describe("multi-board registry and defaults", () => {
  it("defaults existing reads to main and denies an unallowlisted board", async () => {
    const client = {
      getBoard: vi.fn(async (id: string) => ({ id, name: id, url: `https://trello/${id}` })),
      getBoardLists: vi.fn(async () => []),
      getBoardLabels: vi.fn(async () => []),
      getBoardCustomFields: vi.fn(async () => [])
    };
    const service = new BoardService(client as never, registry);

    await service.getOverview();
    expect(client.getBoard).toHaveBeenCalledWith("main-board");
    expect(() => service.resolveBoard("hidden")).toThrowError(
      expect.objectContaining({ code: "TRELLO_BOARD_ACCESS_DENIED" })
    );
  });

  it("isolates list-name resolution per selected board", async () => {
    const client = {
      getBoardLists: vi.fn(async (boardId: string) => [
        {
          id: boardId === "main-board" ? "main-ready" : "staging-ready",
          name: "Ready",
          closed: false,
          pos: 1
        }
      ])
    };
    const service = new BoardService(client as never, registry);

    await expect(service.getListByName("Ready", "main")).resolves.toMatchObject({
      id: "main-ready"
    });
    await expect(service.getListByName("Ready", "staging")).resolves.toMatchObject({
      id: "staging-ready"
    });
    expect(client.getBoardLists).toHaveBeenNthCalledWith(1, "main-board");
    expect(client.getBoardLists).toHaveBeenNthCalledWith(2, "staging-board");
  });
});

describe("staging create, read, and update", () => {
  it("keeps all operations scoped to staging", async () => {
    let description = "Initial";
    const rawCard = (): TrelloCard => ({
      id: "staging-card",
      idBoard: "staging-board",
      idList: "staging-inbox",
      name: "Review task",
      desc: description,
      url: "https://trello/card/staging-card",
      due: null,
      dueComplete: false,
      labels: [],
      customFieldItems: [],
      checklists: [],
      attachments: [],
      dateLastActivity: "2026-07-16T00:00:00.000Z",
      pos: 1
    });
    const client = {
      getBoardLists: vi.fn(async (boardId: string) =>
        boardId === "staging-board"
          ? [{ id: "staging-inbox", name: "Email Review", closed: false, pos: 1 }]
          : [{ id: "main-inbox", name: "Email Review", closed: false, pos: 1 }]
      ),
      getBoardCustomFields: vi.fn(async () => []),
      getBoardLabels: vi.fn(async () => []),
      getCardsForList: vi.fn(async () => [rawCard()]),
      getCard: vi.fn(async () => rawCard()),
      getCardComments: vi.fn(async () => []),
      createCard: vi.fn(async () => rawCard()),
      updateCardDescription: vi.fn(async (_id: string, next: string) => {
        description = next;
        return rawCard();
      })
    };
    const boards = new BoardService(client as never, registry);
    const cards = new CardService(client as never, boards);
    const writes = new WriteService(client as never, boards, cards);

    await writes.createCard({
      listName: "Email Review",
      name: "Review task",
      description: "Initial"
    });
    await cards.getCardsInList({ listName: "Email Review" }, {}, "staging");
    const result = await writes.updateDescription("staging-card", "Updated", "staging");

    expect(client.createCard).toHaveBeenCalledWith(
      expect.objectContaining({ listId: "staging-inbox", description: "Initial" })
    );
    expect(client.getCardsForList).toHaveBeenCalledWith("staging-inbox", expect.any(Object));
    expect(result).toMatchObject({
      boardId: "staging-board",
      listId: "staging-inbox",
      cardId: "staging-card",
      card: { description: "Updated" } satisfies Partial<NormalizedCard>
    });
  });
});
