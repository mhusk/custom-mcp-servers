import { describe, expect, it } from "vitest";

import {
  addCardCommentSchema,
  addCardLabelSchema,
  addChecklistItemSchema,
  createCardChecklistSchema,
  removeCardLabelSchema,
  updateCardCustomFieldSchema,
  updateCardDescriptionSchema,
  createListSchema,
  createCardSchema
} from "../../src/tools/writeTools.js";

describe("write tool schemas", () => {
  it("rejects empty card IDs", () => {
    expect(() => addCardCommentSchema.parse({ cardId: "", text: "Hello" })).toThrow();
    expect(() => updateCardDescriptionSchema.parse({ cardId: "", description: "" })).toThrow();
    expect(() =>
      updateCardCustomFieldSchema.parse({
        cardId: "",
        customFieldId: "field-1",
        value: "Ready"
      })
    ).toThrow();
  });

  it("rejects empty comment text", () => {
    expect(() => addCardCommentSchema.parse({ cardId: "card-1", text: "" })).toThrow();
  });

  it("rejects empty checklist names and IDs", () => {
    expect(() => createCardChecklistSchema.parse({ cardId: "card-1", name: "" })).toThrow();
    expect(() =>
      addChecklistItemSchema.parse({
        cardId: "card-1",
        checklistId: "",
        name: "First step"
      })
    ).toThrow();
    expect(() =>
      addChecklistItemSchema.parse({
        cardId: "card-1",
        checklistId: "checklist-1",
        name: ""
      })
    ).toThrow();
  });

  it("rejects invalid custom field values", () => {
    expect(() =>
      updateCardCustomFieldSchema.parse({
        cardId: "card-1",
        customFieldId: "field-1",
        value: { text: "Ready" }
      })
    ).toThrow();
  });

  it("rejects empty custom field IDs and option IDs", () => {
    expect(() =>
      updateCardCustomFieldSchema.parse({
        cardId: "card-1",
        customFieldId: "",
        value: "Ready"
      })
    ).toThrow();

    expect(() =>
      updateCardCustomFieldSchema.parse({
        cardId: "card-1",
        customFieldId: "field-1",
        value: { idValue: "" }
      })
    ).toThrow();
  });

  it("rejects empty label IDs", () => {
    expect(() => addCardLabelSchema.parse({ cardId: "card-1", labelId: "" })).toThrow();
    expect(() => removeCardLabelSchema.parse({ cardId: "card-1", labelId: "" })).toThrow();
  });

  it("rejects excessively long inputs", () => {
    expect(() => addCardCommentSchema.parse({ cardId: "card-1", text: "a".repeat(16385) })).toThrow();
    expect(() => addCardCommentSchema.parse({ cardId: "c".repeat(51), text: "Hello" })).toThrow();
    expect(() => createCardChecklistSchema.parse({ cardId: "card-1", name: "a".repeat(501) })).toThrow();
    expect(() => updateCardDescriptionSchema.parse({ cardId: "card-1", description: "a".repeat(16385) })).toThrow();
    expect(() => createListSchema.parse({ board: "staging", name: "a".repeat(101) })).toThrow();
    expect(() => createCardSchema.parse({ board: "staging", listName: "a", name: "a".repeat(501), description: "desc" })).toThrow();
  });
});
