import { describe, expect, it, vi } from "vitest";

import { toCustomFieldUpdatePayload, WriteService } from "../../src/services/writeService.js";
import type {
  NormalizedCard,
  TrelloCard,
  TrelloCustomFieldDefinition
} from "../../src/types/trello.js";
import { MutationVerificationError, NotFoundError } from "../../src/utils/errors.js";

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

const refreshedCard: NormalizedCard = {
  id: "card-1",
  title: "Build thing",
  url: "https://example.com",
  status: "todo",
  list: { id: "list-1", name: "To Do" },
  description: null,
  dueDate: null,
  dueComplete: false,
  labels: [{ id: "label-1", name: "AI Reviewed", color: "blue" }],
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
    createCardChecklist: vi.fn(async () => ({
      id: "checklist-1",
      name: "Steps",
      checkItems: []
    })),
    addChecklistItem: vi.fn(async () => ({
      id: "item-1",
      name: "First step",
      state: "incomplete"
    })),
    updateCardDescription: vi.fn(),
    updateCardCustomField: vi.fn(),
    clearCardCustomField: vi.fn(),
    getBoardLabels: vi.fn(async () => [{ id: "label-1", name: "AI Reviewed", color: "blue" }]),
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
    service: new WriteService(
      client as never,
      boardService as never,
      cardService as never,
      "main-board"
    )
  };
}

describe("WriteService board guard", () => {
  it("rejects write attempts for cards outside the configured board", async () => {
    const { client, service } = makeService({ ...baseCard, idBoard: "other-board" });

    await expect(service.addComment("card-1", "Hello")).rejects.toThrow(NotFoundError);
    await expect(service.createChecklist("card-1", "Steps")).rejects.toThrow(NotFoundError);
    await expect(service.addChecklistItem("card-1", "checklist-1", "First step")).rejects.toThrow(
      NotFoundError
    );
    expect(client.addCardComment).not.toHaveBeenCalled();
    expect(client.createCardChecklist).not.toHaveBeenCalled();
    expect(client.addChecklistItem).not.toHaveBeenCalled();
  });

  it("returns the refreshed normalized card after a mutation", async () => {
    const { client, cardService, service } = makeService();

    await expect(service.addLabel("card-1", "label-1")).resolves.toEqual(refreshedCard);
    expect(client.addCardLabel).toHaveBeenCalledWith("card-1", "label-1");
    expect(cardService.getCardDetails).toHaveBeenCalledWith("card-1");
  });

  it("treats adding an existing label as a no-op", async () => {
    const { client, service } = makeService({
      ...baseCard,
      labels: [{ id: "label-1", name: "AI Reviewed", color: "blue" }]
    });

    await expect(service.addLabel("card-1", "label-1")).resolves.toEqual(refreshedCard);
    expect(client.addCardLabel).not.toHaveBeenCalled();
  });

  it("removes an existing label and returns the updated label list", async () => {
    const { client, cardService, service } = makeService({
      ...baseCard,
      labels: [{ id: "label-1", name: "AI Reviewed", color: "blue" }]
    });
    const cardWithoutLabel = { ...refreshedCard, labels: [] };
    cardService.getCardDetails.mockResolvedValueOnce(cardWithoutLabel);

    await expect(service.removeLabel("card-1", "label-1")).resolves.toEqual(cardWithoutLabel);
    expect(client.removeCardLabel).toHaveBeenCalledWith("card-1", "label-1");
  });

  it("rejects label IDs that do not belong to the configured board", async () => {
    const { client, cardService, service } = makeService();

    await expect(service.addLabel("card-1", "missing-label")).rejects.toMatchObject({
      code: "TRELLO_LABEL_NOT_FOUND"
    });
    expect(client.addCardLabel).not.toHaveBeenCalled();
    expect(cardService.getCardDetails).not.toHaveBeenCalled();
  });

  it("reports a silent Trello no-op as a mutation verification error", async () => {
    const { cardService, service } = makeService();
    cardService.getCardDetails.mockResolvedValueOnce({ ...refreshedCard, labels: [] });

    await expect(service.addLabel("card-1", "label-1")).rejects.toThrow(MutationVerificationError);
  });

  it("creates a checklist and returns the refreshed normalized card", async () => {
    const { client, cardService, service } = makeService();
    const cardWithChecklist = {
      ...refreshedCard,
      checklists: [{ id: "checklist-1", name: "Steps", items: [] }]
    };
    cardService.getCardDetails.mockResolvedValueOnce(cardWithChecklist);

    await expect(service.createChecklist("card-1", "Steps")).resolves.toEqual(cardWithChecklist);
    expect(client.createCardChecklist).toHaveBeenCalledWith("card-1", "Steps");
  });

  it("only adds items to a checklist on the guarded card", async () => {
    const { client, cardService, service } = makeService({
      ...baseCard,
      checklists: [{ id: "checklist-1", name: "Steps", checkItems: [] }]
    });
    const cardWithItem = {
      ...refreshedCard,
      checklists: [
        {
          id: "checklist-1",
          name: "Steps",
          items: [
            {
              id: "item-1",
              name: "First step",
              complete: false,
              dueDate: null
            }
          ]
        }
      ]
    };
    cardService.getCardDetails.mockResolvedValueOnce(cardWithItem);

    await expect(service.addChecklistItem("card-1", "checklist-1", "First step")).resolves.toEqual(
      cardWithItem
    );
    expect(client.addChecklistItem).toHaveBeenCalledWith("checklist-1", "First step");
  });

  it("rejects checklist IDs that do not belong to the guarded card", async () => {
    const { client, cardService, service } = makeService();

    await expect(
      service.addChecklistItem("card-1", "other-checklist", "First step")
    ).rejects.toMatchObject({ code: "TRELLO_CHECKLIST_NOT_FOUND" });
    expect(client.addChecklistItem).not.toHaveBeenCalled();
    expect(cardService.getCardDetails).not.toHaveBeenCalled();
  });

  it("does not add a comment when a checklist write fails", async () => {
    const { client, service } = makeService();
    client.createCardChecklist.mockRejectedValueOnce(new Error("write failed"));

    await expect(service.createChecklist("card-1", "Steps")).rejects.toThrow("write failed");
    expect(client.addCardComment).not.toHaveBeenCalled();
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
