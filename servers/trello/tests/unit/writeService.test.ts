import { describe, expect, it, vi } from "vitest";

import {
  toCustomFieldUpdatePayload,
  WriteService
} from "../../src/services/writeService.js";
import type { TrelloCard, TrelloCustomFieldDefinition } from "../../src/types/trello.js";
import { NotFoundError } from "../../src/utils/errors.js";

const baseCard: TrelloCard = {
  id: "card-1",
  idBoard: "main-board",
  idList: "list-1",
  name: "Build thing",
  desc: "",
  url: "https://example.com",
  due: null,
  dueComplete: false,
  dateLastActivity: "2026-07-09T00:00:00.000Z",
  pos: 1
};

const refreshedCard = {
  id: "card-1",
  title: "Build thing",
  url: "https://example.com",
  status: "todo",
  list: { id: "list-1", name: "To Do" },
  description: null,
  dueDate: null,
  dueComplete: false,
  labels: [],
  customFields: [],
  checklists: [],
  attachments: [],
  comments: [],
  lastActivityAt: "2026-07-09T00:00:00.000Z",
  position: 1
};

function makeService(card: TrelloCard = baseCard) {
  const client = {
    getCard: vi.fn(async () => card),
    addCardComment: vi.fn(),
    updateCardDescription: vi.fn(),
    updateCardCustomField: vi.fn(),
    clearCardCustomField: vi.fn(),
    addCardLabel: vi.fn(),
    removeCardLabel: vi.fn()
  };
  const boardService = {
    getCustomFieldDefinitions: vi.fn(async () => [
      { id: "field-text", name: "Notes", type: "text" }
    ])
  };
  const cardService = {
    getCardDetails: vi.fn(async () => refreshedCard)
  };

  return {
    client,
    boardService,
    cardService,
    service: new WriteService(client as never, boardService as never, cardService as never, "main-board")
  };
}

describe("WriteService board guard", () => {
  it("rejects write attempts for cards outside the configured board", async () => {
    const { client, service } = makeService({ ...baseCard, idBoard: "other-board" });

    await expect(service.addComment("card-1", "Hello")).rejects.toThrow(NotFoundError);
    expect(client.addCardComment).not.toHaveBeenCalled();
  });

  it("returns the refreshed normalized card after a mutation", async () => {
    const { client, cardService, service } = makeService();

    await expect(service.addLabel("card-1", "label-1")).resolves.toEqual(refreshedCard);
    expect(client.addCardLabel).toHaveBeenCalledWith("card-1", "label-1");
    expect(cardService.getCardDetails).toHaveBeenCalledWith("card-1");
  });
});

describe("toCustomFieldUpdatePayload", () => {
  it("maps text values", () => {
    expect(toCustomFieldUpdatePayload(field("text"), "Ready")).toEqual({
      value: { text: "Ready" }
    });
  });

  it("maps number values", () => {
    expect(toCustomFieldUpdatePayload(field("number"), 3)).toEqual({
      value: { number: "3" }
    });
  });

  it("maps checkbox values", () => {
    expect(toCustomFieldUpdatePayload(field("checkbox"), true)).toEqual({
      value: { checked: "true" }
    });
  });

  it("maps date values", () => {
    expect(toCustomFieldUpdatePayload(field("date"), "2026-07-10T12:00:00.000Z")).toEqual({
      value: { date: "2026-07-10T12:00:00.000Z" }
    });
  });

  it("maps list option idValue objects", () => {
    expect(toCustomFieldUpdatePayload(field("list"), { idValue: "option-1" })).toEqual({
      idValue: "option-1"
    });
  });

  it("maps list option string IDs", () => {
    expect(toCustomFieldUpdatePayload(field("list"), "option-1")).toEqual({
      idValue: "option-1"
    });
  });
});

describe("WriteService custom field clearing", () => {
  it("clears custom fields when value is null", async () => {
    const { client, boardService, service } = makeService();

    await service.updateCustomField("card-1", "field-text", null);

    expect(client.clearCardCustomField).toHaveBeenCalledWith("card-1", "field-text");
    expect(client.updateCardCustomField).not.toHaveBeenCalled();
    expect(boardService.getCustomFieldDefinitions).not.toHaveBeenCalled();
  });
});

function field(type: string): TrelloCustomFieldDefinition {
  return {
    id: "field-1",
    idModel: "board-1",
    modelType: "board",
    name: "Field",
    type
  };
}
