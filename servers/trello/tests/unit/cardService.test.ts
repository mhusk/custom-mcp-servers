import { describe, expect, it } from "vitest";

import {
  isDueSoon,
  isOverdue,
  normalizeCard,
  normalizeCustomFields,
  parseCustomFieldItemValue,
  sortWorkItems,
  toWorkItem
} from "../../src/services/cardService.js";
import type {
  NormalizedCard,
  TrelloCard,
  TrelloCustomFieldDefinition,
  TrelloList
} from "../../src/types/trello.js";

const list: TrelloList = {
  id: "list-todo",
  name: "To Do",
  closed: false,
  pos: 1
};

const customFieldDefinitions: TrelloCustomFieldDefinition[] = [
  {
    id: "cf-priority",
    idModel: "board",
    modelType: "board",
    name: "Priority",
    type: "list",
    options: [
      {
        id: "option-high",
        idCustomField: "cf-priority",
        value: { text: "High" }
      }
    ]
  },
  {
    id: "cf-estimate",
    idModel: "board",
    modelType: "board",
    name: "Estimate",
    type: "number"
  }
];

const card: TrelloCard = {
  id: "card-1",
  idBoard: "board-1",
  idList: "list-todo",
  name: "Build first version",
  desc: "Ship a useful read-only MCP server.",
  url: "https://trello.example/c/card-1",
  due: "2026-07-15T12:00:00.000Z",
  dueComplete: false,
  labels: [{ id: "label-1", name: "Work", color: "blue" }],
  checklists: [
    {
      id: "checklist-1",
      name: "Launch",
      checkItems: [
        {
          id: "item-1",
          name: "Compile",
          state: "complete",
          due: "2026-07-11T12:00:00.000Z"
        },
        {
          id: "item-2",
          name: "Test",
          state: "incomplete"
        }
      ]
    }
  ],
  attachments: [{ id: "attachment-1", name: "Spec", url: "https://example.com/spec" }],
  customFieldItems: [
    {
      id: "item-priority",
      idCustomField: "cf-priority",
      idModel: "card-1",
      idValue: "option-high"
    },
    { id: "item-estimate", idCustomField: "cf-estimate", idModel: "card-1", value: { number: "3" } }
  ],
  dateLastActivity: "2026-07-09T12:00:00.000Z",
  pos: 123
};

function makeNormalized(overrides: Partial<NormalizedCard>): NormalizedCard {
  return {
    id: "card",
    title: "Build thing",
    url: "https://example.com",
    status: "todo",
    list: { id: "list", name: "To Do" },
    description: "Description",
    dueDate: null,
    dueComplete: false,
    labels: [],
    customFields: [],
    checklists: [],
    attachments: [],
    comments: [],
    lastActivityAt: "2026-07-09T00:00:00.000Z",
    position: 1,
    ...overrides
  };
}

describe("normalizeCard", () => {
  it("normalizes cards, custom fields, checklists, attachments, and comments", () => {
    const normalized = normalizeCard(card, list, customFieldDefinitions, [
      {
        id: "comment-1",
        date: "2026-07-09T13:00:00.000Z",
        data: { text: "Looks good" },
        memberCreator: { fullName: "Ada Lovelace" }
      }
    ]);

    expect(normalized).toMatchObject({
      id: "card-1",
      title: "Build first version",
      status: "todo",
      description: "Ship a useful read-only MCP server.",
      dueDate: "2026-07-15T12:00:00.000Z",
      dueComplete: false,
      labels: [{ id: "label-1", name: "Work", color: "blue" }],
      customFields: [
        { id: "cf-priority", name: "Priority", type: "list", value: "High" },
        { id: "cf-estimate", name: "Estimate", type: "number", value: 3 }
      ],
      checklists: [
        {
          id: "checklist-1",
          name: "Launch",
          items: [
            {
              id: "item-1",
              name: "Compile",
              complete: true,
              dueDate: "2026-07-11T12:00:00.000Z"
            },
            { id: "item-2", name: "Test", complete: false, dueDate: null }
          ]
        }
      ],
      comments: [
        {
          id: "comment-1",
          text: "Looks good",
          createdAt: "2026-07-09T13:00:00.000Z",
          authorName: "Ada Lovelace"
        }
      ],
      position: 123
    });
  });
});

describe("custom field parsing", () => {
  it("maps missing custom field items to null", () => {
    expect(normalizeCustomFields([], customFieldDefinitions)).toEqual([
      { id: "cf-priority", name: "Priority", type: "list", value: null },
      { id: "cf-estimate", name: "Estimate", type: "number", value: null }
    ]);
  });

  it("resolves list option values", () => {
    expect(
      parseCustomFieldItemValue(
        {
          id: "item-priority",
          idCustomField: "cf-priority",
          idModel: "card-1",
          idValue: "option-high"
        },
        customFieldDefinitions[0]!
      )
    ).toBe("High");
  });
});

describe("date logic", () => {
  const now = new Date("2026-07-10T12:00:00.000Z");

  it("detects due-soon incomplete cards", () => {
    expect(isDueSoon(makeNormalized({ dueDate: "2026-07-12T12:00:00.000Z" }), 7, now)).toBe(true);
    expect(isDueSoon(makeNormalized({ dueDate: "2026-07-20T12:00:00.000Z" }), 7, now)).toBe(false);
    expect(
      isDueSoon(makeNormalized({ dueDate: "2026-07-12T12:00:00.000Z", dueComplete: true }), 7, now)
    ).toBe(false);
  });

  it("detects overdue incomplete cards", () => {
    expect(isOverdue(makeNormalized({ dueDate: "2026-07-09T12:00:00.000Z" }), now)).toBe(true);
    expect(isOverdue(makeNormalized({ dueDate: "2026-07-11T12:00:00.000Z" }), now)).toBe(false);
    expect(
      isOverdue(makeNormalized({ dueDate: "2026-07-09T12:00:00.000Z", dueComplete: true }), now)
    ).toBe(false);
  });
});

describe("sortWorkItems", () => {
  it("orders overdue cards first, then due date, then no due date by Trello position", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const items = [
      toWorkItem(makeNormalized({ id: "no-due-later", dueDate: null, position: 20 }), now),
      toWorkItem(
        makeNormalized({ id: "future-later", dueDate: "2026-07-20T00:00:00.000Z", position: 1 }),
        now
      ),
      toWorkItem(
        makeNormalized({ id: "overdue", dueDate: "2026-07-09T00:00:00.000Z", position: 99 }),
        now
      ),
      toWorkItem(
        makeNormalized({ id: "future-sooner", dueDate: "2026-07-11T00:00:00.000Z", position: 3 }),
        now
      ),
      toWorkItem(makeNormalized({ id: "no-due-sooner", dueDate: null, position: 10 }), now)
    ];

    expect(sortWorkItems(items).map((item) => item.id)).toEqual([
      "overdue",
      "future-sooner",
      "future-later",
      "no-due-sooner",
      "no-due-later"
    ]);
  });
});
