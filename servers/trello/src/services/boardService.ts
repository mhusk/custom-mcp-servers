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

export function normalizeListName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export class BoardService {
  constructor(
    private readonly client: TrelloClient,
    private readonly boardId: string
  ) {}

  async getBoard(): Promise<TrelloBoard> {
    return this.client.getBoard(this.boardId);
  }

  async getLists(): Promise<TrelloList[]> {
    return this.client.getBoardLists(this.boardId);
  }

  async getCustomFieldDefinitions(): Promise<TrelloCustomFieldDefinition[]> {
    return this.client.getBoardCustomFields(this.boardId);
  }

  async getListByName(name: string): Promise<TrelloList> {
    const lists = await this.getLists();
    const requested = normalizeListName(name);
    const list = lists.find((candidate) => normalizeListName(candidate.name) === requested);

    if (!list) {
      const available = lists.map((candidate) => candidate.name).join(", ");
      throw new NotFoundError(
        `Trello list "${name}" was not found on the configured board. Available lists: ${available}.`,
        "TRELLO_LIST_NOT_FOUND"
      );
    }

    return list;
  }

  async getListsByNames(names: string[]): Promise<TrelloList[]> {
    return Promise.all(names.map((name) => this.getListByName(name)));
  }

  async getOverview(): Promise<BoardOverview> {
    const [board, lists, labels, customFields] = await Promise.all([
      this.client.getBoard(this.boardId),
      this.client.getBoardLists(this.boardId),
      this.client.getBoardLabels(this.boardId),
      this.client.getBoardCustomFields(this.boardId)
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
