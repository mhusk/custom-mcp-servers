import type { TrelloClient } from "../clients/trelloClient.js";
import type { TrelloCustomFieldDefinition, TrelloList, TrelloValue } from "../types/trello.js";
import type {
  NormalizedCard,
  TrelloCard,
  TrelloCommentAction,
  TrelloCustomFieldItem
} from "../types/trello.js";
import type { WorkItem, WorkItemStatus } from "../types/workItem.js";
import { NotFoundError } from "../utils/errors.js";
import { BoardService, normalizeListName, parseCustomFieldRawValue } from "./boardService.js";

export type CardFetchOptions = {
  includeComments?: boolean;
  includeAttachments?: boolean;
};

export class CardService {
  constructor(
    private readonly client: TrelloClient,
    private readonly boardService: BoardService,
    private readonly legacyBoardId?: string
  ) {}

  async getCardsInList(
    selector: string | { listId?: string; listName?: string },
    options: CardFetchOptions = {},
    board: string = "main"
  ): Promise<NormalizedCard[]> {
    const list =
      typeof selector === "string"
        ? await this.boardService.getListByName(selector, board)
        : await this.boardService.getList(selector, board);
    const definitions = await this.boardService.getCustomFieldDefinitions(board);
    const cards = await this.client.getCardsForList(list.id, {
      includeAttachments: options.includeAttachments ?? true
    });
    const commentsByCard = await this.loadComments(cards, options.includeComments ?? false);

    return cards.map((card) =>
      normalizeCard(card, list, definitions, commentsByCard.get(card.id) ?? [])
    );
  }

  async getCardDetails(
    cardId: string,
    options: CardFetchOptions = {},
    board: string = "main"
  ): Promise<NormalizedCard> {
    const includeAttachments = options.includeAttachments ?? true;
    const includeComments = options.includeComments ?? true;
    const boardId = this.legacyBoardId ?? this.boardService.resolveBoard(board).id;
    const [card, lists, definitions] = await Promise.all([
      this.client.getCard(cardId, { includeAttachments }),
      this.boardService.getLists(board),
      this.boardService.getCustomFieldDefinitions(board)
    ]);

    if (card.idBoard !== boardId) {
      throw new NotFoundError(
        "The requested Trello card does not belong to the selected allowlisted board.",
        "TRELLO_CARD_WRONG_BOARD"
      );
    }

    const list = lists.find((candidate) => candidate.id === card.idList);
    if (!list) {
      throw new NotFoundError(
        "The requested Trello card's list was not found.",
        "TRELLO_LIST_NOT_FOUND"
      );
    }

    const comments = includeComments ? await this.client.getCardComments(card.id) : [];
    return normalizeCard(card, list, definitions, comments);
  }

  async getCardsFromLists(
    listNames: string[],
    options: CardFetchOptions = {},
    board: string = "main"
  ): Promise<NormalizedCard[]> {
    const nested = await Promise.all(
      listNames.map((listName) => this.getCardsInList(listName, options, board))
    );
    return nested.flat();
  }

  private async loadComments(
    cards: TrelloCard[],
    includeComments: boolean
  ): Promise<Map<string, TrelloCommentAction[]>> {
    const commentsByCard = new Map<string, TrelloCommentAction[]>();

    if (!includeComments) {
      return commentsByCard;
    }

    await Promise.all(
      cards.map(async (card) => {
        commentsByCard.set(card.id, await this.client.getCardComments(card.id));
      })
    );

    return commentsByCard;
  }
}

export function normalizeCard(
  card: TrelloCard,
  list: TrelloList,
  customFieldDefinitions: TrelloCustomFieldDefinition[],
  comments: TrelloCommentAction[] = []
): NormalizedCard {
  return {
    id: card.id,
    title: card.name,
    url: card.url,
    status: toWorkItemStatus(list.name),
    list: {
      id: list.id,
      name: list.name
    },
    description: card.desc?.trim() ? card.desc : null,
    dueDate: card.due ?? null,
    dueComplete: card.dueComplete ?? false,
    labels: (card.labels ?? []).map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color ?? null
    })),
    customFields: normalizeCustomFields(card.customFieldItems ?? [], customFieldDefinitions),
    checklists: (card.checklists ?? []).map((checklist) => ({
      id: checklist.id,
      name: checklist.name,
      items: (checklist.checkItems ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        complete: item.state === "complete",
        dueDate: item.due ?? null
      }))
    })),
    attachments: (card.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      url: attachment.url
    })),
    comments: comments.map((comment) => ({
      id: comment.id,
      text: comment.data.text ?? "",
      createdAt: comment.date,
      authorName: comment.memberCreator?.fullName ?? comment.memberCreator?.username ?? null
    })),
    lastActivityAt: card.dateLastActivity,
    position: card.pos
  };
}

export function normalizeCustomFields(
  items: TrelloCustomFieldItem[],
  definitions: TrelloCustomFieldDefinition[]
): NormalizedCard["customFields"] {
  return definitions.map((definition) => {
    const item = items.find((candidate) => candidate.idCustomField === definition.id);

    return {
      id: definition.id,
      name: definition.name,
      type: definition.type,
      value: item ? parseCustomFieldItemValue(item, definition) : null
    };
  });
}

export function parseCustomFieldItemValue(
  item: TrelloCustomFieldItem,
  definition: TrelloCustomFieldDefinition
): TrelloValue {
  if (item.idValue) {
    const option = definition.options?.find((candidate) => candidate.id === item.idValue);
    return parseCustomFieldRawValue(option?.value);
  }

  return parseCustomFieldRawValue(item.value);
}

export function toWorkItem(card: NormalizedCard, now: Date = new Date()): WorkItem {
  const customFields = Object.fromEntries(
    card.customFields.map((field) => [field.name, field.value])
  ) as Record<string, string | number | boolean | null>;

  return {
    id: card.id,
    source: "trello",
    sourceUrl: card.url,
    title: card.title,
    description: card.description,
    status: toWorkItemStatus(card.list.name),
    dueDate: card.dueDate,
    overdue: isOverdue(card, now),
    labels: card.labels.map((label) => label.name).filter(Boolean),
    customFields,
    checklists: card.checklists.map((checklist) => {
      const completedItems = checklist.items.filter((item) => item.complete).length;
      return {
        name: checklist.name,
        completedItems,
        totalItems: checklist.items.length,
        items: checklist.items.map((item) => ({
          name: item.name,
          complete: item.complete,
          dueDate: item.dueDate
        }))
      };
    }),
    lastActivityAt: card.lastActivityAt,
    position: card.position,
    metadata: {
      trelloCardId: card.id,
      trelloListId: card.list.id,
      trelloListName: card.list.name
    }
  };
}

export function toWorkItemStatus(listName: string): WorkItemStatus {
  switch (normalizeListName(listName)) {
    case "backlog":
      return "backlog";
    case "todo":
      return "todo";
    case "blocked":
      return "blocked";
    case "done":
      return "done";
    default:
      return "other";
  }
}

export function isOverdue(card: NormalizedCard, now: Date = new Date()): boolean {
  return Boolean(
    card.dueDate && !card.dueComplete && new Date(card.dueDate).getTime() < now.getTime()
  );
}

export function isDueSoon(card: NormalizedCard, days: number, now: Date = new Date()): boolean {
  if (!card.dueDate || card.dueComplete) {
    return false;
  }

  const due = new Date(card.dueDate).getTime();
  const start = now.getTime();
  const end = start + days * 24 * 60 * 60 * 1000;
  return due >= start && due <= end;
}

export function sortWorkItems(items: WorkItem[]): WorkItem[] {
  return [...items].sort((a, b) => {
    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    if (a.dueDate && b.dueDate) {
      const dueDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (dueDiff !== 0) {
        return dueDiff;
      }
    } else if (a.dueDate) {
      return -1;
    } else if (b.dueDate) {
      return 1;
    }

    return a.position - b.position;
  });
}
