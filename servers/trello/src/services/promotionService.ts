import type { NormalizedCard } from "../types/trello.js";
import { AppError } from "../utils/errors.js";
import type { BoardService } from "./boardService.js";
import type { CardService } from "./cardService.js";
import type { PromotionRecord, PromotionStore } from "./promotionStore.js";
import type { WriteResult, WriteService } from "./writeService.js";

export type PromotionInput = {
  stagingCardId: string;
  destinationBoard: "main";
  destinationListId: string;
  idempotencyKey: string;
};

export type PromotionResult = WriteResult & {
  stagingBoardId: string;
  stagingCardId: string;
  idempotencyKey: string;
  idempotentReplay: boolean;
};

export class PromotionService {
  constructor(
    private readonly boardService: BoardService,
    private readonly cardService: CardService,
    private readonly writeService: WriteService,
    private readonly store: PromotionStore
  ) {}

  async promote(input: PromotionInput): Promise<PromotionResult> {
    const staging = this.boardService.resolveBoard("staging");
    const destination = this.boardService.resolveBoard(input.destinationBoard);
    const existing = await this.store.get(input.idempotencyKey);

    if (existing) {
      this.assertMatchingRetry(existing, input, destination.id);
      if (existing.status === "created") {
        await this.finishStagingCard(input.stagingCardId, existing.mainCardUrl);
        await this.store.set({ ...existing, status: "complete" });
      }
      return {
        boardId: existing.destinationBoardId,
        listId: existing.destinationListId,
        cardId: existing.mainCardId,
        url: existing.mainCardUrl,
        stagingBoardId: staging.id,
        stagingCardId: input.stagingCardId,
        idempotencyKey: input.idempotencyKey,
        idempotentReplay: true
      };
    }

    const source = await this.cardService.getCardDetails(
      input.stagingCardId,
      { includeComments: false, includeAttachments: false },
      "staging"
    );
    if (source.list.name !== "Ready to Transfer") {
      throw new AppError(
        'Promotion requires the staging card to be in "Ready to Transfer".',
        "TRELLO_PROMOTION_NOT_APPROVED",
        409
      );
    }

    try {
      // Resolve the destination before creating anything. A missing or cross-board list must fail
      // without silently falling back to another list or board.
      await this.boardService.getList({ listId: input.destinationListId }, input.destinationBoard);
      const created = await this.writeService.createCardOnBoard(input.destinationBoard, {
        listId: input.destinationListId,
        name: source.title,
        description: buildSafeDescription(source),
        ...(source.dueDate ? { due: source.dueDate } : {})
      });
      const record: PromotionRecord = {
        idempotencyKey: input.idempotencyKey,
        stagingCardId: input.stagingCardId,
        destinationBoardId: destination.id,
        destinationListId: input.destinationListId,
        mainCardId: created.cardId!,
        mainCardUrl: created.url,
        status: "created"
      };
      // Persist immediately after creation, before subsequent staging mutations, so a retry never
      // creates a second main-board card if linking or moving the source fails.
      await this.store.set(record);
      await this.finishStagingCard(input.stagingCardId, created.url);
      await this.store.set({ ...record, status: "complete" });

      return {
        ...created,
        stagingBoardId: staging.id,
        stagingCardId: input.stagingCardId,
        idempotencyKey: input.idempotencyKey,
        idempotentReplay: false
      };
    } catch (error) {
      await this.moveToErrorsBestEffort(input.stagingCardId);
      throw error;
    }
  }

  private async finishStagingCard(stagingCardId: string, mainCardUrl: string): Promise<void> {
    const transferred = await this.boardService.getListByName("Transferred / Logged", "staging");
    await this.writeService.addComment(stagingCardId, `Promoted task: ${mainCardUrl}`, "staging");
    await this.writeService.moveCardWithinBoard("staging", stagingCardId, transferred.id);
  }

  private async moveToErrorsBestEffort(stagingCardId: string): Promise<void> {
    try {
      const errors = await this.boardService.getListByName("Errors / Needs Review", "staging");
      await this.writeService.moveCardWithinBoard("staging", stagingCardId, errors.id);
    } catch {
      // Preserve the original failure. If even the recovery list is unavailable, the source card
      // remains in its current list and is still recoverable by an operator.
    }
  }

  private assertMatchingRetry(
    record: PromotionRecord,
    input: PromotionInput,
    destinationBoardId: string
  ): void {
    if (
      record.stagingCardId !== input.stagingCardId ||
      record.destinationBoardId !== destinationBoardId ||
      record.destinationListId !== input.destinationListId
    ) {
      throw new AppError(
        "The idempotency key was already used for a different promotion request.",
        "TRELLO_IDEMPOTENCY_CONFLICT",
        409
      );
    }
  }
}

export function buildSafeDescription(card: NormalizedCard): string {
  const summary =
    safeField(card, "Task Summary") ?? extractSection(card.description, "Task Summary");
  const outcome =
    safeField(card, "Intended Outcome") ?? extractSection(card.description, "Intended Outcome");
  return [
    summary ? `## Task summary\n${summary}` : undefined,
    outcome ? `## Intended outcome\n${outcome}` : undefined,
    `## Source\n${card.url}`
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

function safeField(card: NormalizedCard, name: string): string | undefined {
  const value = card.customFields.find(
    (field) => field.name.trim().toLowerCase() === name.toLowerCase()
  )?.value;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractSection(description: string | null, heading: string): string | undefined {
  if (!description) return undefined;
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = description.match(
    new RegExp(`(?:^|\\n)#{0,3}\\s*${escaped}\\s*:?\\s*\\n([^]*?)(?=\\n#{1,3}\\s|$)`, "i")
  );
  return match?.[1]?.trim() || undefined;
}
