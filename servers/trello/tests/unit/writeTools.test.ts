import { describe, expect, it } from "vitest";

import {
  addCardCommentSchema,
  addCardLabelSchema,
  removeCardLabelSchema,
  updateCardCustomFieldSchema,
  updateCardDescriptionSchema
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
});
