export type WorkItemStatus = "backlog" | "todo" | "blocked" | "done" | "other";

export type WorkItem = {
  id: string;
  source: "trello";
  sourceUrl: string;
  title: string;
  description: string | null;
  status: WorkItemStatus;
  dueDate: string | null;
  overdue: boolean;
  labels: string[];
  customFields: Record<string, string | number | boolean | null>;
  checklists: Array<{
    name: string;
    completedItems: number;
    totalItems: number;
    items: Array<{
      name: string;
      complete: boolean;
      dueDate: string | null;
    }>;
  }>;
  lastActivityAt: string;
  position: number;
  metadata: {
    trelloCardId: string;
    trelloListId: string;
    trelloListName: string;
  };
};

export type UnderdefinedIssue = {
  code: string;
  severity: "info" | "warning";
  message: string;
};

export type UnderdefinedCardResult = {
  card: import("./trello.js").NormalizedCard;
  issues: UnderdefinedIssue[];
  completenessScore: number;
};
