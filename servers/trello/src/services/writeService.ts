import type { TrelloClient, TrelloCustomFieldUpdatePayload } from "../clients/trelloClient.js";
import type { BoardService } from "./boardService.js";
import type { CardService } from "./cardService.js";
import type { NormalizedCard, TrelloCustomFieldDefinition } from "../types/trello.js";
import { NotFoundError } from "../utils/errors.js";

export type CustomFieldUpdateValue =
  | string
  | number
  | boolean
  | null
  | {
      idValue: string;
    };

export class WriteService {
  constructor(
    private readonly client: TrelloClient,
    private readonly boardService: BoardService,
    private readonly cardService: CardService,
    private readonly boardId: string
  ) {}

  async addComment(cardId: string, text: string): Promise<NormalizedCard> {
    await this.assertCardOnConfiguredBoard(cardId);
    await this.client.addCardComment(cardId, text);
    return this.cardService.getCardDetails(cardId);
  }

  async updateDescription(cardId: string, description: string): Promise<NormalizedCard> {
    await this.assertCardOnConfiguredBoard(cardId);
    await this.client.updateCardDescription(cardId, description);
    return this.cardService.getCardDetails(cardId);
  }

  async updateCustomField(
    cardId: string,
    customFieldId: string,
    value: CustomFieldUpdateValue
  ): Promise<NormalizedCard> {
    await this.assertCardOnConfiguredBoard(cardId);

    if (value === null) {
      await this.client.clearCardCustomField(cardId, customFieldId);
      return this.cardService.getCardDetails(cardId);
    }

    const definition = await this.getCustomFieldDefinition(customFieldId);
    await this.client.updateCardCustomField(
      cardId,
      customFieldId,
      toCustomFieldUpdatePayload(definition, value)
    );
    return this.cardService.getCardDetails(cardId);
  }

  async addLabel(cardId: string, labelId: string): Promise<NormalizedCard> {
    await this.assertCardOnConfiguredBoard(cardId);
    await this.client.addCardLabel(cardId, labelId);
    return this.cardService.getCardDetails(cardId);
  }

  async removeLabel(cardId: string, labelId: string): Promise<NormalizedCard> {
    await this.assertCardOnConfiguredBoard(cardId);
    await this.client.removeCardLabel(cardId, labelId);
    return this.cardService.getCardDetails(cardId);
  }

  private async assertCardOnConfiguredBoard(cardId: string): Promise<void> {
    const card = await this.client.getCard(cardId, { includeAttachments: false });

    if (card.idBoard !== this.boardId) {
      throw new NotFoundError(
        "The requested Trello card does not belong to the configured main board.",
        "TRELLO_CARD_WRONG_BOARD"
      );
    }
  }

  private async getCustomFieldDefinition(
    customFieldId: string
  ): Promise<TrelloCustomFieldDefinition> {
    const definitions = await this.boardService.getCustomFieldDefinitions();
    const definition = definitions.find((candidate) => candidate.id === customFieldId);

    if (!definition) {
      throw new NotFoundError(
        "The requested Trello custom field was not found on the configured board.",
        "TRELLO_CUSTOM_FIELD_NOT_FOUND"
      );
    }

    return definition;
  }
}

export function toCustomFieldUpdatePayload(
  definition: TrelloCustomFieldDefinition,
  value: Exclude<CustomFieldUpdateValue, null>
): TrelloCustomFieldUpdatePayload {
  if (isIdValue(value)) {
    return { idValue: value.idValue };
  }

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

  if (option) {
    return option.id;
  }

  return String(value);
}
