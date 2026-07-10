import { describe, expect, it } from "vitest";

import {
  analyzeUnderdefinedCard,
  calculateCompletenessScore,
  searchCards
} from "../../src/tools/analysisTools.js";
import type { NormalizedCard } from "../../src/types/trello.js";

function card(overrides: Partial<NormalizedCard>): NormalizedCard {
  return {
    id: "card",
    title: "Build weekly plan",
    url: "https://example.com",
    status: "todo",
    list: { id: "list", name: "To Do" },
    description: "A clear description long enough to satisfy the default threshold.",
    dueDate: "2026-07-15T00:00:00.000Z",
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

describe("searchCards", () => {
  it("ranks title matches ahead of description-only matches", () => {
    const results = searchCards(
      [
        card({
          id: "description",
          title: "Prepare docs",
          description: "Contains api keyword",
          position: 1
        }),
        card({ id: "title", title: "Review API", description: "No match here", position: 2 })
      ],
      "api",
      20
    );

    expect(results.map((result) => result.id)).toEqual(["title", "description"]);
  });
});

describe("analyzeUnderdefinedCard", () => {
  it("flags deterministic underdefinition issues", () => {
    const result = analyzeUnderdefinedCard(
      card({
        title: "TBD",
        description: "- one\n- two",
        dueDate: null,
        customFields: [{ id: "cf", name: "Owner", type: "text", value: null }]
      }),
      40
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      "short_description",
      "vague_title",
      "no_action_verb",
      "missing_checklist",
      "empty_custom_fields",
      "missing_due_date"
    ]);
    expect(result.completenessScore).toBe(20);
  });

  it("calculates score with warning and info penalties", () => {
    expect(
      calculateCompletenessScore([
        { code: "warning", severity: "warning", message: "Warning" },
        { code: "info", severity: "info", message: "Info" }
      ])
    ).toBe(80);
  });
});
