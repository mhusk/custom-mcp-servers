import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type PromotionRecord = {
  idempotencyKey: string;
  stagingCardId: string;
  destinationBoardId: string;
  destinationListId: string;
  mainCardId: string;
  mainCardUrl: string;
  status: "created" | "complete";
};

export interface PromotionStore {
  get(key: string): Promise<PromotionRecord | undefined>;
  set(record: PromotionRecord): Promise<void>;
}

export class FilePromotionStore implements PromotionStore {
  constructor(private readonly path: string) {}

  async get(key: string): Promise<PromotionRecord | undefined> {
    const records = await this.readAll();
    return records[key];
  }

  async set(record: PromotionRecord): Promise<void> {
    const records = await this.readAll();
    records[record.idempotencyKey] = record;
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(temporaryPath, this.path);
  }

  private async readAll(): Promise<Record<string, PromotionRecord>> {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as Record<string, PromotionRecord>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }
}

export class MemoryPromotionStore implements PromotionStore {
  private readonly records = new Map<string, PromotionRecord>();
  async get(key: string): Promise<PromotionRecord | undefined> {
    return this.records.get(key);
  }
  async set(record: PromotionRecord): Promise<void> {
    this.records.set(record.idempotencyKey, record);
  }
}
