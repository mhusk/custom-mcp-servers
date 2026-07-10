import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { CardService } from "../services/cardService.js";
import type { NormalizedCard } from "../types/trello.js";
import type { UnderdefinedCardResult, UnderdefinedIssue } from "../types/workItem.js";
import { isDueSoon, isOverdue } from "../services/cardService.js";
import { safeTool } from "./result.js";

const searchCardsSchema = z.object({
  query: z.string().trim().min(1),
  lists: z.array(z.string().trim().min(1)).default(["Back-Log", "To-Do", "Blocked", "Done"]),
  limit: z.number().int().min(1).max(100).default(20)
});

const getDueSoonSchema = z.object({
  days: z.number().int().min(0).max(365).default(7),
  lists: z.array(z.string().trim().min(1)).default(["Back-Log", "To-Do"])
});

const getOverdueCardsSchema = z.object({
  lists: z.array(z.string().trim().min(1)).default(["Back-Log", "To-Do", "Blocked"])
});

const findUnderdefinedCardsSchema = z.object({
  lists: z.array(z.string().trim().min(1)).default(["Back-Log", "To-Do"]),
  minimumDescriptionLength: z.number().int().min(0).max(1000).default(40)
});

export function registerAnalysisTools(server: McpServer, cardService: CardService): void {
  server.registerTool(
    "search_cards",
    {
      title: "Search Trello cards",
      description:
        "Read-only. Searches card titles and descriptions locally after retrieving cards from the configured board. Version 1 uses case-insensitive substring matching and ranks title matches ahead of description-only matches.",
      inputSchema: searchCardsSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = searchCardsSchema.parse(input);
        const cards = await cardService.getCardsFromLists(args.lists, {
          includeComments: false,
          includeAttachments: false
        });
        return searchCards(cards, args.query, args.limit);
      })
  );

  server.registerTool(
    "get_due_soon",
    {
      title: "Get Trello cards due soon",
      description:
        "Read-only. Returns incomplete cards due between the current UTC time and the end of the requested day window. Defaults to Back-Log and To-Do over the next 7 days.",
      inputSchema: getDueSoonSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = getDueSoonSchema.parse(input);
        const cards = await cardService.getCardsFromLists(args.lists, {
          includeComments: false,
          includeAttachments: false
        });
        return cards.filter((card) => isDueSoon(card, args.days));
      })
  );

  server.registerTool(
    "get_overdue_cards",
    {
      title: "Get overdue Trello cards",
      description:
        "Read-only. Returns cards from the requested configured-board lists whose due date is before the current time and whose Trello dueComplete flag is false.",
      inputSchema: getOverdueCardsSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = getOverdueCardsSchema.parse(input);
        const cards = await cardService.getCardsFromLists(args.lists, {
          includeComments: false,
          includeAttachments: false
        });
        return cards.filter((card) => isOverdue(card));
      })
  );

  server.registerTool(
    "find_underdefined_cards",
    {
      title: "Find underdefined Trello cards",
      description:
        "Read-only. Uses deterministic local rules only; it does not call an LLM. Flags cards that may need clearer descriptions, action-oriented titles, checklists, custom fields, or due dates, and returns a documented 0-100 completeness score.",
      inputSchema: findUnderdefinedCardsSchema.shape
    },
    async (input) =>
      safeTool(async () => {
        const args = findUnderdefinedCardsSchema.parse(input);
        const cards = await cardService.getCardsFromLists(args.lists, {
          includeComments: false,
          includeAttachments: true
        });
        return cards.map((card) => analyzeUnderdefinedCard(card, args.minimumDescriptionLength));
      })
  );
}

export function searchCards(
  cards: NormalizedCard[],
  query: string,
  limit: number
): NormalizedCard[] {
  const needle = query.trim().toLowerCase();

  return cards
    .map((card) => ({
      card,
      titleMatch: card.title.toLowerCase().includes(needle),
      descriptionMatch: (card.description ?? "").toLowerCase().includes(needle)
    }))
    .filter((match) => match.titleMatch || match.descriptionMatch)
    .sort((a, b) => {
      if (a.titleMatch !== b.titleMatch) {
        return a.titleMatch ? -1 : 1;
      }

      return a.card.position - b.card.position;
    })
    .slice(0, limit)
    .map((match) => match.card);
}

export function analyzeUnderdefinedCard(
  card: NormalizedCard,
  minimumDescriptionLength: number
): UnderdefinedCardResult {
  const issues: UnderdefinedIssue[] = [];
  const description = card.description?.trim() ?? "";

  if (!description) {
    issues.push({
      code: "missing_description",
      severity: "warning",
      message: "Card has no description."
    });
  } else if (description.length < minimumDescriptionLength) {
    issues.push({
      code: "short_description",
      severity: "warning",
      message: `Description is shorter than ${minimumDescriptionLength} characters.`
    });
  }

  if (isVagueTitle(card.title)) {
    issues.push({
      code: "vague_title",
      severity: "warning",
      message: "Title appears vague or placeholder-like."
    });
  }

  if (!hasActionVerb(card.title)) {
    issues.push({
      code: "no_action_verb",
      severity: "warning",
      message: "Title does not start with a clear action verb."
    });
  }

  if (appearsMultiStep(description) && card.checklists.length === 0) {
    issues.push({
      code: "missing_checklist",
      severity: "warning",
      message: "Description appears to describe multiple steps but the card has no checklist."
    });
  }

  if (card.customFields.some((field) => field.value === null || field.value === "")) {
    issues.push({
      code: "empty_custom_fields",
      severity: "warning",
      message: "One or more custom fields are empty."
    });
  }

  if (!card.dueDate) {
    issues.push({
      code: "missing_due_date",
      severity: "info",
      message: "Card has no due date. This may be fine for backlog work."
    });
  }

  return {
    card,
    issues,
    completenessScore: calculateCompletenessScore(issues)
  };
}

export function calculateCompletenessScore(issues: UnderdefinedIssue[]): number {
  const penalty = issues.reduce(
    (total, issue) => total + (issue.severity === "warning" ? 15 : 5),
    0
  );
  return Math.max(0, Math.min(100, 100 - penalty));
}

function isVagueTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return (
    normalized.length < 8 || /^(todo|task|misc|stuff|follow up|tbd|fix|update)$/i.test(normalized)
  );
}

function hasActionVerb(title: string): boolean {
  const firstWord = title.trim().split(/\s+/)[0]?.toLowerCase();
  const verbs = new Set([
    "add",
    "audit",
    "build",
    "call",
    "check",
    "clean",
    "create",
    "define",
    "draft",
    "email",
    "finish",
    "fix",
    "follow",
    "implement",
    "investigate",
    "make",
    "plan",
    "prepare",
    "publish",
    "refactor",
    "reply",
    "review",
    "schedule",
    "send",
    "ship",
    "test",
    "update",
    "write"
  ]);

  return verbs.has(firstWord ?? "");
}

function appearsMultiStep(description: string): boolean {
  const bulletMatches = description.match(/(^|\n)\s*([-*]|\d+\.)\s+/g) ?? [];
  const connectiveMatches = description.match(/\b(first|then|next|finally|also)\b/gi) ?? [];
  return bulletMatches.length >= 2 || connectiveMatches.length >= 2;
}
