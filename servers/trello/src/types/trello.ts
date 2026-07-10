export type TrelloValue = string | number | boolean | null;

export type TrelloListName =
  "Back-Log" | "To-Do" | "Blocked" | "Done" | "Repeat Cards" | "Template Cards";

export const EXPECTED_LIST_NAMES: TrelloListName[] = [
  "Back-Log",
  "To-Do",
  "Blocked",
  "Done",
  "Repeat Cards",
  "Template Cards"
];

export type TrelloBoard = {
  id: string;
  name: string;
  url: string;
  shortUrl?: string;
};

export type TrelloList = {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
};

export type TrelloLabel = {
  id: string;
  name: string;
  color: string | null;
};

export type TrelloCustomFieldDefinition = {
  id: string;
  idModel: string;
  modelType: string;
  name: string;
  type: string;
  options?: Array<{
    id: string;
    idCustomField: string;
    value: Partial<Record<"text" | "number" | "checked" | "date", string>>;
    color?: string | null;
  }>;
};

export type TrelloCustomFieldItem = {
  id: string;
  idCustomField: string;
  idModel: string;
  idValue?: string;
  value?: Partial<Record<"text" | "number" | "checked" | "date", string>>;
};

export type TrelloChecklist = {
  id: string;
  name: string;
  checkItems: TrelloCheckItem[];
};

export type TrelloCheckItem = {
  id: string;
  name: string;
  state: "complete" | "incomplete";
  due?: string | null;
};

export type TrelloAttachment = {
  id: string;
  name: string;
  url: string;
};

export type TrelloCommentAction = {
  id: string;
  date: string;
  data: {
    text?: string;
  };
  memberCreator?: {
    fullName?: string;
    username?: string;
  };
};

export type TrelloCard = {
  id: string;
  idBoard: string;
  idList: string;
  name: string;
  desc?: string;
  url: string;
  due?: string | null;
  dueComplete?: boolean;
  labels?: TrelloLabel[];
  checklists?: TrelloChecklist[];
  attachments?: TrelloAttachment[];
  customFieldItems?: TrelloCustomFieldItem[];
  dateLastActivity: string;
  pos: number;
  closed?: boolean;
};

export type NormalizedCard = {
  id: string;
  title: string;
  url: string;
  status: string;
  list: {
    id: string;
    name: string;
  };
  description: string | null;
  dueDate: string | null;
  dueComplete: boolean;
  labels: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
  customFields: Array<{
    id: string;
    name: string;
    type: string;
    value: TrelloValue;
  }>;
  checklists: Array<{
    id: string;
    name: string;
    items: Array<{
      id: string;
      name: string;
      complete: boolean;
      dueDate: string | null;
    }>;
  }>;
  attachments: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  comments: Array<{
    id: string;
    text: string;
    createdAt: string;
    authorName: string | null;
  }>;
  lastActivityAt: string;
  position: number;
};

export type BoardOverview = {
  id: string;
  name: string;
  url: string;
  lists: Array<{
    id: string;
    name: string;
    closed: boolean;
    openCardCount: number;
  }>;
  labels: TrelloLabel[];
  customFields: Array<{
    id: string;
    name: string;
    type: string;
    options: Array<{
      id: string;
      value: string | number | boolean | null;
    }>;
  }>;
};
