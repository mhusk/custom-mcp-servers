import type {
  TrelloBoard,
  TrelloCard,
  TrelloCheckItem,
  TrelloChecklist,
  TrelloCommentAction,
  TrelloCustomFieldDefinition,
  TrelloLabel,
  TrelloList
} from "../types/trello.js";
import { TrelloApiError } from "../utils/errors.js";

export type TrelloClientOptions = {
  apiKey: string;
  token: string;
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type QueryValue = string | number | boolean | null | undefined;
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type TrelloCustomFieldUpdatePayload =
  { value: Partial<Record<"text" | "number" | "checked" | "date", string>> } | { idValue: string };

export class TrelloClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: TrelloClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getBoard(boardId: string): Promise<TrelloBoard> {
    return this.request<TrelloBoard>(`/boards/${encodeURIComponent(boardId)}`, {
      fields: "id,name,url,shortUrl"
    });
  }

  async getBoardLists(boardId: string): Promise<TrelloList[]> {
    return this.request<TrelloList[]>(`/boards/${encodeURIComponent(boardId)}/lists`, {
      fields: "id,name,closed,pos",
      filter: "all"
    });
  }

  async getBoardLabels(boardId: string): Promise<TrelloLabel[]> {
    return this.request<TrelloLabel[]>(`/boards/${encodeURIComponent(boardId)}/labels`, {
      fields: "id,name,color",
      limit: 1000
    });
  }

  async getBoardCustomFields(boardId: string): Promise<TrelloCustomFieldDefinition[]> {
    return this.request<TrelloCustomFieldDefinition[]>(
      `/boards/${encodeURIComponent(boardId)}/customFields`
    );
  }

  async getCardsForList(
    listId: string,
    options: { includeAttachments: boolean }
  ): Promise<TrelloCard[]> {
    return this.request<TrelloCard[]>(`/lists/${encodeURIComponent(listId)}/cards`, {
      filter: "open",
      fields: "id,idBoard,idList,name,desc,url,due,dueComplete,labels,dateLastActivity,pos,closed",
      labels: "all",
      checklists: "all",
      customFieldItems: true,
      attachments: options.includeAttachments
    });
  }

  async getCard(cardId: string, options: { includeAttachments: boolean }): Promise<TrelloCard> {
    return this.request<TrelloCard>(`/cards/${encodeURIComponent(cardId)}`, {
      fields: "id,idBoard,idList,name,desc,url,due,dueComplete,labels,dateLastActivity,pos,closed",
      labels: "all",
      checklists: "all",
      customFieldItems: true,
      attachments: options.includeAttachments
    });
  }

  async getCardComments(cardId: string): Promise<TrelloCommentAction[]> {
    return this.request<TrelloCommentAction[]>(`/cards/${encodeURIComponent(cardId)}/actions`, {
      filter: "commentCard",
      fields: "id,date,data",
      memberCreator: true,
      memberCreator_fields: "fullName,username",
      limit: 1000
    });
  }

  async addCardComment(cardId: string, text: string): Promise<TrelloCommentAction> {
    return this.request<TrelloCommentAction>(
      `/cards/${encodeURIComponent(cardId)}/actions/comments`,
      {
        text
      },
      { method: "POST" }
    );
  }

  async createCardChecklist(cardId: string, name: string): Promise<TrelloChecklist> {
    return this.request<TrelloChecklist>(
      `/cards/${encodeURIComponent(cardId)}/checklists`,
      { name },
      { method: "POST" }
    );
  }

  async addChecklistItem(checklistId: string, name: string): Promise<TrelloCheckItem> {
    return this.request<TrelloCheckItem>(
      `/checklists/${encodeURIComponent(checklistId)}/checkItems`,
      { name },
      { method: "POST" }
    );
  }

  async updateCardDescription(cardId: string, description: string): Promise<TrelloCard> {
    return this.request<TrelloCard>(
      `/cards/${encodeURIComponent(cardId)}`,
      {
        desc: description
      },
      { method: "PUT" }
    );
  }

  async updateCardCustomField(
    cardId: string,
    customFieldId: string,
    payload: TrelloCustomFieldUpdatePayload
  ): Promise<unknown> {
    return this.request<unknown>(
      `/cards/${encodeURIComponent(cardId)}/customField/${encodeURIComponent(customFieldId)}/item`,
      {},
      { method: "PUT", body: payload }
    );
  }

  async clearCardCustomField(cardId: string, customFieldId: string): Promise<unknown> {
    return this.request<unknown>(
      `/cards/${encodeURIComponent(cardId)}/customField/${encodeURIComponent(customFieldId)}/item`,
      {},
      { method: "DELETE" }
    );
  }

  async addCardLabel(cardId: string, labelId: string): Promise<unknown> {
    return this.request<unknown>(
      `/cards/${encodeURIComponent(cardId)}/idLabels`,
      {
        value: labelId
      },
      { method: "POST" }
    );
  }

  async removeCardLabel(cardId: string, labelId: string): Promise<unknown> {
    return this.request<unknown>(
      `/cards/${encodeURIComponent(cardId)}/idLabels/${encodeURIComponent(labelId)}`,
      {},
      { method: "DELETE" }
    );
  }

  private async request<T>(
    path: string,
    query: Record<string, QueryValue> = {},
    options: { method?: HttpMethod; body?: unknown } = {}
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const method = options.method ?? "GET";

    try {
      const response = await this.fetchImpl(url, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(options.body === undefined ? {} : { "Content-Type": "application/json" })
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return (await parseJsonResponse(response)) as T;
    } catch (error) {
      if (error instanceof TrelloApiError) {
        throw error;
      }

      if (isAbortError(error)) {
        throw new TrelloApiError("Trello API request timed out.", "TRELLO_TIMEOUT");
      }

      throw new TrelloApiError("Trello API is unavailable.", "TRELLO_UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(path: string, query: Record<string, QueryValue>): string {
    const url = new URL(`${this.options.baseUrl}${path}`);
    url.searchParams.set("key", this.options.apiKey);
    url.searchParams.set("token", this.options.token);

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const body = await safeReadBody(response);

    if (response.status === 401 || response.status === 403) {
      throw new TrelloApiError(
        "Trello authentication failed.",
        "TRELLO_AUTH_FAILED",
        response.status
      );
    }

    if (response.status === 404) {
      throw new TrelloApiError("Requested Trello resource was not found.", "TRELLO_NOT_FOUND", 404);
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const suffix = retryAfter ? ` Retry after ${retryAfter} seconds.` : "";
      throw new TrelloApiError(
        `Trello API rate limit reached.${suffix}`,
        "TRELLO_RATE_LIMITED",
        429
      );
    }

    if (response.status >= 500) {
      throw new TrelloApiError(
        "Trello API is temporarily unavailable.",
        "TRELLO_UNAVAILABLE",
        response.status
      );
    }

    throw new TrelloApiError(
      `Trello API request failed with HTTP ${response.status}${body ? `: ${body}` : ""}.`,
      "TRELLO_REQUEST_FAILED",
      response.status
    );
  }
}

async function safeReadBody(response: Response): Promise<string | null> {
  try {
    const text = await response.text();
    return text ? redactSecrets(text) : null;
  } catch {
    return null;
  }
}

function redactSecrets(value: string): string {
  return value.replace(/([?&](?:key|token)=)[^&\s]+/gi, "$1[redacted]");
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new TrelloApiError("Trello API returned malformed JSON.", "TRELLO_INVALID_RESPONSE", 502);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}
