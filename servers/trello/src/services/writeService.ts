import type { TrelloClient, TrelloCustomFieldUpdatePayload } from "../clients/trelloClient.js";
import type { NormalizedCard, TrelloCard, TrelloCustomFieldDefinition } from "../types/trello.js";
import { MutationVerificationError, NotFoundError } from "../utils/errors.js";
import type { BoardService } from "./boardService.js";
import { normalizeListName } from "./boardService.js";
import type { CardService } from "./cardService.js";

export type CustomFieldUpdateValue =
  | string
  | number
  | boolean
  | null
  | {
      idValue: string;
    };

export type WriteResult = {
  boardId: string;
  listId: string;
  cardId: string | null;
  url: string;
  card?: NormalizedCard;
};

export type CreateCardInput = {
  listId?: string;
  listName?: string;
  name: string;
  description: string;
  due?: string;
  labels?: string[];
  customFields?: Record<string, CustomFieldUpdateValue>;
};

export class WriteService {
  constructor(
    private readonly client: TrelloClient,
    private readonly boardService: BoardService,
    private readonly cardService: CardService,
    private readonly legacyBoardId?: string
  ) {}

  async createList(name: string, position?: string | number): Promise<WriteResult> {
    const board = this.resolveBoard("staging");
    const existing = await this.boardService.getLists("staging");
    if (
      existing.some(
        (list) => !list.closed && normalizeListName(list.name) === normalizeListName(name)
      )
    ) {
      throw new NotFoundError(
        `An open list matching "${name}" already exists on the staging board.`,
        "TRELLO_LIST_ALREADY_EXISTS"
      );
    }
    const list = await this.client.createList(board.id, name, position);
    const boardDetails = await this.client.getBoard(board.id);
    return { boardId: board.id, listId: list.id, cardId: null, url: boardDetails.url };
  }

  async createCard(input: CreateCardInput): Promise<WriteResult> {
    return this.createCardOnBoard("staging", input);
  }

  async createCardOnBoard(boardSelector: string, input: CreateCardInput): Promise<WriteResult> {
    const board = this.resolveBoard(boardSelector);
    const list = await this.boardService.getList(
      { listId: input.listId, listName: input.listName },
      boardSelector
    );
    const labelIds = await this.resolveLabelIds(board.id, input.labels ?? []);
    const customFields = input.customFields ?? {};
    const definitions = await this.boardService.getCustomFieldDefinitions(boardSelector);
    for (const customFieldId of Object.keys(customFields)) {
      if (!definitions.some((field) => field.id === customFieldId)) {
        throw new NotFoundError(
          "A requested custom field was not found on the selected board.",
          "TRELLO_CUSTOM_FIELD_NOT_FOUND"
        );
      }
    }

    const created = await this.client.createCard({
      listId: list.id,
      name: input.name,
      description: input.description,
      due: input.due,
      labelIds
    });

    for (const [customFieldId, value] of Object.entries(customFields)) {
      await this.applyCustomFieldValue(created.id, definitions, customFieldId, value);
    }
    return this.refreshResult(boardSelector, created.id);
  }

  async moveCardWithinBoard(
    boardSelector: string,
    cardId: string,
    destinationListId: string
  ): Promise<WriteResult> {
    await this.getCardOnBoard(cardId, boardSelector);
    const list = await this.boardService.getList({ listId: destinationListId }, boardSelector);
    await this.client.moveCard(cardId, list.id);
    return this.refreshResult(boardSelector, cardId);
  }

  async addComment(cardId: string, text: string, board = "main"): Promise<WriteResult> {
    await this.getCardOnBoard(cardId, board);
    await this.client.addCardComment(cardId, text);
    return this.refreshResult(board, cardId);
  }

  async createChecklist(cardId: string, name: string, board = "main"): Promise<WriteResult> {
    await this.getCardOnBoard(cardId, board);
    const checklist = await this.client.createCardChecklist(cardId, name);
    const result = await this.refreshResult(board, cardId);

    if (!result.card?.checklists.some((candidate) => candidate.id === checklist.id)) {
      throw new MutationVerificationError(
        "Trello reported success, but the new checklist was not present on the refreshed card."
      );
    }
    return result;
  }

  async addChecklistItem(
    cardId: string,
    checklistId: string,
    name: string,
    board = "main"
  ): Promise<WriteResult> {
    const card = await this.getCardOnBoard(cardId, board);
    if (!card.checklists?.some((checklist) => checklist.id === checklistId)) {
      throw new NotFoundError(
        "The requested Trello checklist was not found on the specified card.",
        "TRELLO_CHECKLIST_NOT_FOUND"
      );
    }
    const item = await this.client.addChecklistItem(checklistId, name);
    const result = await this.refreshResult(board, cardId);
    const checklist = result.card?.checklists.find((candidate) => candidate.id === checklistId);
    if (!checklist?.items.some((candidate) => candidate.id === item.id)) {
      throw new MutationVerificationError(
        "Trello reported success, but the new checklist item was not present on the refreshed card."
      );
    }
    return result;
  }

  async updateDescription(
    cardId: string,
    description: string,
    board = "main"
  ): Promise<WriteResult> {
    await this.getCardOnBoard(cardId, board);
    await this.client.updateCardDescription(cardId, description);
    return this.refreshResult(board, cardId);
  }

  async updateCustomField(
    cardId: string,
    customFieldId: string,
    value: CustomFieldUpdateValue,
    board = "main"
  ): Promise<WriteResult> {
    await this.getCardOnBoard(cardId, board);
    if (value === null) {
      await this.client.clearCardCustomField(cardId, customFieldId);
      return this.refreshResult(board, cardId);
    }
    const definitions = await this.boardService.getCustomFieldDefinitions(board);
    await this.applyCustomFieldValue(cardId, definitions, customFieldId, value);
    return this.refreshResult(board, cardId);
  }

  async addLabel(cardId: string, labelId: string, board = "main"): Promise<WriteResult> {
    const card = await this.getCardOnBoard(cardId, board);
    const boardId = this.resolveBoard(board).id;
    await this.resolveLabelIds(boardId, [labelId]);
    if (!card.labels?.some((label) => label.id === labelId)) {
      await this.client.addCardLabel(cardId, labelId);
    }
    const result = await this.refreshResult(board, cardId);
    if (!result.card?.labels.some((label) => label.id === labelId)) {
      throw new MutationVerificationError(
        "Trello reported success, but the requested label was not present on the refreshed card."
      );
    }
    return result;
  }

  async removeLabel(cardId: string, labelId: string, board = "main"): Promise<WriteResult> {
    const card = await this.getCardOnBoard(cardId, board);
    if (card.labels?.some((label) => label.id === labelId)) {
      await this.client.removeCardLabel(cardId, labelId);
    }
    const result = await this.refreshResult(board, cardId);
    if (result.card?.labels.some((label) => label.id === labelId)) {
      throw new MutationVerificationError(
        "Trello reported success, but the requested label was still present on the refreshed card."
      );
    }
    return result;
  }

  private resolveBoard(board: string) {
    if (this.legacyBoardId) {
      if (board !== "main" && board !== this.legacyBoardId) {
        throw new NotFoundError("The requested Trello board is not configured.");
      }
      return { alias: "main", id: this.legacyBoardId, name: "" };
    }
    return this.boardService.resolveBoard(board);
  }

  private async getCardOnBoard(cardId: string, board: string): Promise<TrelloCard> {
    const boardId = this.resolveBoard(board).id;
    const card = await this.client.getCard(cardId, { includeAttachments: false });
    if (card.idBoard !== boardId) {
      throw new NotFoundError(
        "The requested Trello card does not belong to the selected allowlisted board.",
        "TRELLO_CARD_WRONG_BOARD"
      );
    }
    return card;
  }

  private async refreshResult(board: string, cardId: string): Promise<WriteResult> {
    const boardId = this.resolveBoard(board).id;
    const card = await this.cardService.getCardDetails(cardId, {}, board);
    return { boardId, listId: card.list.id, cardId: card.id, url: card.url, card };
  }

  private async resolveLabelIds(boardId: string, selectors: string[]): Promise<string[]> {
    if (selectors.length === 0) return [];
    const labels = await this.client.getBoardLabels(boardId);
    return selectors.map((selector) => {
      const matches = labels.filter(
        (label) =>
          label.id === selector || normalizeListName(label.name) === normalizeListName(selector)
      );
      if (matches.length === 0) {
        throw new NotFoundError(
          `Trello label "${selector}" was not found on the selected board.`,
          "TRELLO_LABEL_NOT_FOUND"
        );
      }
      if (matches.length > 1) {
        throw new NotFoundError(
          `Trello label "${selector}" is ambiguous; use its ID.`,
          "TRELLO_LABEL_AMBIGUOUS"
        );
      }
      return matches[0]!.id;
    });
  }

  private async applyCustomFieldValue(
    cardId: string,
    definitions: TrelloCustomFieldDefinition[],
    customFieldId: string,
    value: CustomFieldUpdateValue
  ): Promise<void> {
    const definition = definitions.find((candidate) => candidate.id === customFieldId);
    if (!definition) {
      throw new NotFoundError(
        "The requested Trello custom field was not found on the selected board.",
        "TRELLO_CUSTOM_FIELD_NOT_FOUND"
      );
    }
    if (value === null) {
      await this.client.clearCardCustomField(cardId, customFieldId);
      return;
    }
    await this.client.updateCardCustomField(
      cardId,
      customFieldId,
      toCustomFieldUpdatePayload(definition, value)
    );
  }
}

export function toCustomFieldUpdatePayload(
  definition: TrelloCustomFieldDefinition,
  value: Exclude<CustomFieldUpdateValue, null>
): TrelloCustomFieldUpdatePayload {
  if (isIdValue(value)) return { idValue: value.idValue };
  switch (definition.type) {
    case "checkbox":
      return { value: { checked: String(Boolean(value)) } };
    case "date":
      return { value: { date: String(value) } };
    case "number":
      return { value: { number: String(value) } };
    case "text":
      return { value: { text: String(value) } };
    case "list":
      return { idValue: resolveCustomFieldOptionId(definition, value) };
    default:
      return { value: { text: String(value) } };
  }
}

function isIdValue(value: CustomFieldUpdateValue): value is { idValue: string } {
  return typeof value === "object" && value !== null && "idValue" in value;
}

function resolveCustomFieldOptionId(
  definition: TrelloCustomFieldDefinition,
  value: Exclude<CustomFieldUpdateValue, null | { idValue: string }>
): string {
  const option = definition.options?.find((candidate) => candidate.id === String(value));
  return option?.id ?? String(value);
}
