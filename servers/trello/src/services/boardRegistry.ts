import type { BoardRegistryEntry } from "../config.js";
import { AccessDeniedError, NotFoundError } from "../utils/errors.js";

export type ResolvedBoard = BoardRegistryEntry & { alias: string };

export class BoardRegistry {
  private readonly allowedIds: Set<string>;

  constructor(
    private readonly entries: Record<string, BoardRegistryEntry>,
    allowedBoardIds: Iterable<string>
  ) {
    this.allowedIds = new Set(allowedBoardIds);
  }

  resolve(board: string = "main"): ResolvedBoard {
    const byAlias = this.entries[board];
    const byId = Object.entries(this.entries).find(([, entry]) => entry.id === board);
    const resolved = byAlias
      ? { alias: board, ...byAlias }
      : byId
        ? { alias: byId[0], ...byId[1] }
        : undefined;

    if (!resolved) {
      throw new AccessDeniedError("The requested Trello board is not registered.");
    }
    if (!this.allowedIds.has(resolved.id)) {
      throw new AccessDeniedError("The requested Trello board is not allowlisted.");
    }
    return resolved;
  }

  requireAlias(alias: string): ResolvedBoard {
    if (!this.entries[alias]) {
      throw new NotFoundError(`The required Trello board alias "${alias}" is not configured.`);
    }
    return this.resolve(alias);
  }

  listAllowed(): ResolvedBoard[] {
    return Object.entries(this.entries)
      .filter(([, entry]) => this.allowedIds.has(entry.id))
      .map(([alias, entry]) => ({ alias, ...entry }));
  }
}
