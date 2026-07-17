import type { TrelloClient } from "../clients/trelloClient.js";
import type {
  BoardOverview,
  TrelloBoard,
  TrelloCustomFieldDefinition,
  TrelloList,
  TrelloValue
} from "../types/trello.js";
import { EXPECTED_LIST_NAMES } from "../types/trello.js";
import { NotFoundError } from "../utils/errors.js";
import type { BoardRegistry, ResolvedBoard } from "./boardRegistry.js";

export function normalizeListName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export class BoardService {
  constructor(
    private readonly client: TrelloClient,
    private readonly registry: BoardRegistry | string
  ) {}

  resolveBoard(board: string = "main"): ResolvedBoard {
    if (typeof this.registry === "string") {
      if (board !== "main" && board !== this.registry) {
        throw new NotFoundError("The requested Trello board is not configured.");
      }
      return { alias: "main", id: this.registry, name: "" };
    }
    return this.registry.resolve(board);
  }

  listAllowedBoards(): ResolvedBoard[] {
    if (typeof this.registry === "string") {
      return [{ alias: "main", id: this.registry, name: "" }];
    }
    return this.registry.listAllowed();
  }

  async getBoard(board: string = "main"): Promise<TrelloBoard> {
    return this.client.getBoard(this.resolveBoard(board).id);
  }

  async getLists(board: string = "main"): Promise<TrelloList[]> {
    return this.client.getBoardLists(this.resolveBoard(board).id);
  }

  async getCustomFieldDefinitions(board: string = "main"): Promise<TrelloCustomFieldDefinition[]> {
    return this.client.getBoardCustomFields(this.resolveBoard(board).id);
  }

  async getListByName(name: string, board: string = "main"): Promise<TrelloList> {
    const resolved = this.resolveBoard(board);
    const lists = await this.client.getBoardLists(resolved.id);
    const requested = normalizeListName(name);
    const matches = lists.filter(
      (candidate) => !candidate.closed && normalizeListName(candidate.name) === requested
    );

    if (matches.length === 0) {
      const available = lists
        .filter((list) => !list.closed)
        .map((candidate) => candidate.name)
        .join(", ");
      throw new NotFoundError(
        `Trello list "${name}" was not found on board "${resolved.alias}". Available lists: ${available}.`,
        "TRELLO_LIST_NOT_FOUND"
      );
    }
    if (matches.length > 1) {
      throw new NotFoundError(
        `Trello list name "${name}" is ambiguous on board "${resolved.alias}"; use listId.`,
        "TRELLO_LIST_AMBIGUOUS"
      );
    }
    return matches[0]!;
  }

  async getList(
    selector: { listId?: string; listName?: string },
    board: string = "main"
  ): Promise<TrelloList> {
    if (Boolean(selector.listId) === Boolean(selector.listName)) {
      throw new NotFoundError(
        "Provide exactly one of listId or listName.",
        "TRELLO_LIST_SELECTOR_INVALID"
      );
    }
    if (selector.listName) {
      return this.getListByName(selector.listName, board);
    }

    const lists = await this.getLists(board);
    const list = lists.find((candidate) => candidate.id === selector.listId && !candidate.closed);
    if (!list) {
      throw new NotFoundError(
        "The requested open Trello list was not found on the selected board.",
        "TRELLO_LIST_NOT_FOUND"
      );
    }
    return list;
  }

  async getListsByNames(names: string[], board: string = "main"): Promise<TrelloList[]> {
    return Promise.all(names.map((name) => this.getListByName(name, board)));
  }

  async getOverview(boardSelector: string = "main"): Promise<BoardOverview> {
    const boardId = this.resolveBoard(boardSelector).id;
    const [board, lists, labels, customFields] = await Promise.all([
      this.client.getBoard(boardId),
      this.client.getBoardLists(boardId),
      this.client.getBoardLabels(boardId),
      this.client.getBoardCustomFields(boardId)
    ]);

    const cardCounts = await Promise.all(
      lists.map(async (list) => {
        const cards = list.closed
          ? []
          : await this.client.getCardsForList(list.id, { includeAttachments: false });

        return {
          id: list.id,
          name: list.name,
          closed: list.closed,
          openCardCount: cards.length
        };
      })
    );

    return {
      id: board.id,
      name: board.name,
      url: board.url,
      lists: cardCounts,
      labels,
      customFields: customFields.map((field) => ({
        id: field.id,
        name: field.name,
        type: field.type,
        options: (field.options ?? []).map((option) => ({
          id: option.id,
          value: parseCustomFieldRawValue(option.value)
        }))
      }))
    };
  }
}

export function defaultKnownListNames(): string[] {
  return [...EXPECTED_LIST_NAMES];
}

export function parseCustomFieldRawValue(
  value: Partial<Record<"text" | "number" | "checked" | "date", string>> | undefined
): TrelloValue {
  if (!value) {
    return null;
  }

  if (value.text !== undefined) {
    return value.text;
  }

  if (value.number !== undefined) {
    const number = Number(value.number);
    return Number.isFinite(number) ? number : value.number;
  }

  if (value.checked !== undefined) {
    return value.checked === "true";
  }

  if (value.date !== undefined) {
    return value.date;
  }

  return null;
}
