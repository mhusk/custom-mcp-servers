import { describe, expect, it } from "vitest";

import { normalizeListName, parseCustomFieldRawValue } from "../../src/services/boardService.js";

describe("normalizeListName", () => {
  it("trims, lowercases, and removes punctuation from list names", () => {
    expect(normalizeListName("  To Do  ")).toBe("todo");
    expect(normalizeListName("To-Do")).toBe("todo");
    expect(normalizeListName("Back-Log")).toBe("backlog");
  });
});

describe("parseCustomFieldRawValue", () => {
  it("parses supported Trello custom field primitive values", () => {
    expect(parseCustomFieldRawValue({ text: "High" })).toBe("High");
    expect(parseCustomFieldRawValue({ number: "42" })).toBe(42);
    expect(parseCustomFieldRawValue({ checked: "true" })).toBe(true);
    expect(parseCustomFieldRawValue({ date: "2026-07-10T00:00:00.000Z" })).toBe(
      "2026-07-10T00:00:00.000Z"
    );
    expect(parseCustomFieldRawValue(undefined)).toBeNull();
  });
});
