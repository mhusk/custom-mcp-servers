import type { TrelloClient, TrelloCustomFieldUpdatePayload } from "../clients/trelloClient.js";
import type { BoardService } from "./boardService.js";
import type { CardService } from "./cardService.js";
import type { NormalizedCard, TrelloCustomFieldDefinition } from "../types/trello.js";
import { MutationVerificationError, NotFoundError } from "../utils/errors.js";

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

  async createChecklist(cardId: string, name: string): Promise<NormalizedCard> {
    await this.assertCardOnConfiguredBoard(cardId);
    const checklist = await this.client.createCardChecklist(cardId, name);
    const refreshedCard = await this.cardService.getCardDetails(cardId);

    if (!refreshedCard.checklists.some((candidate) => candidate.id === checklist.id)) {
      throw new MutationVerificationError(
        "Trello reported success, but the new checklist was not present on the refreshed card."
      );
    }

    return refreshedCard;
  }

  async addChecklistItem(
    cardId: string,
    checklistId: string,
    name: string
  ): Promise<NormalizedCard> {
    const card = await this.getCardOnConfiguredBoard(cardId);

    if (!card.checklists?.some((checklist) => checklist.id === checklistId)) {
      throw new NotFoundError(
        "The requested Trello checklist was not found on the specified card.",
        "TRELLO_CHECKLIST_NOT_FOUND"
      );
    }

    const item = await this.client.addChecklistItem(checklistId, name);
    const refreshedCard = await this.cardService.getCardDetails(cardId);
    const refreshedChecklist = refreshedCard.checklists.find(
      (checklist) => checklist.id === checklistId
    );

    if (!refreshedChecklist?.items.some((candidate) => candidate.id === item.id)) {
      throw new MutationVerificationError(
        "Trello reported success, but the new checklist item was not present on the refreshed card."
      );
    }

    return refreshedCard;
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
    await this.assertLabelOnConfiguredBoard(labelId);
    await this.client.addCardLabel(cardId, labelId);
    const refreshedCard = await this.cardService.getCardDetails(cardId);

    if (!refreshedCard.labels.some((label) => label.id === labelId)) {
      throw new MutationVerificationError(
        "Trello reported success, but the requested label was not present on the refreshed card."
      );
    }

    return refreshedCard;
  }

  async removeLabel(cardId: string, labelId: string): Promise<NormalizedCard> {
    await this.assertCardOnConfiguredBoard(cardId);
    await this.client.removeCardLabel(cardId, labelId);
    return this.cardService.getCardDetails(cardId);
  }

  private async assertCardOnConfiguredBoard(cardId: string): Promise<void> {
    await this.getCardOnConfiguredBoard(cardId);
  }

  private async getCardOnConfiguredBoard(cardId: string) {
    const card = await this.client.getCard(cardId, { includeAttachments: false });

    if (card.idBoard !== this.boardId) {
      throw new NotFoundError(
        "The requested Trello card does not belong to the configured main board.",
        "TRELLO_CARD_WRONG_BOARD"
      );
    }

    return card;
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

  private async assertLabelOnConfiguredBoard(labelId: string): Promise<void> {
    const labels = await this.client.getBoardLabels(this.boardId);

    if (!labels.some((label) => label.id === labelId)) {
      throw new NotFoundError(
        "The requested Trello label was not found on the configured board.",
        "TRELLO_LABEL_NOT_FOUND"
      );
    }
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
