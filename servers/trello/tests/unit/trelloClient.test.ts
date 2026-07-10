import { describe, expect, it, vi } from "vitest";

import { TrelloClient } from "../../src/clients/trelloClient.js";
import { TrelloApiError } from "../../src/utils/errors.js";

function clientWithResponse(response: Response): TrelloClient {
  return new TrelloClient({
    apiKey: "key",
    token: "token",
    baseUrl: "https://api.trello.test/1",
    fetchImpl: vi.fn(async () => response) as unknown as typeof fetch
  });
}

function clientWithFetch(fetchImpl: ReturnType<typeof vi.fn>): TrelloClient {
  return new TrelloClient({
    apiKey: "key",
    token: "token",
    baseUrl: "https://api.trello.test/1",
    fetchImpl: fetchImpl as unknown as typeof fetch
  });
}

function firstFetchCall(fetchImpl: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
}

describe("TrelloClient API error mapping", () => {
  it("maps authentication failures", async () => {
    await expect(
      clientWithResponse(new Response("bad token", { status: 401 })).getBoard("board")
    ).rejects.toMatchObject({
      code: "TRELLO_AUTH_FAILED"
    });
  });

  it("maps rate limits", async () => {
    await expect(
      clientWithResponse(new Response("slow down", { status: 429 })).getBoard("board")
    ).rejects.toMatchObject({
      code: "TRELLO_RATE_LIMITED"
    });
  });

  it("redacts credentials from generic error bodies", async () => {
    await expect(
      clientWithResponse(
        new Response("https://x.test?key=secret&token=secret", { status: 400 })
      ).getBoard("board")
    ).rejects.toThrow(TrelloApiError);
  });
});

describe("TrelloClient write requests", () => {
  it("constructs add comment requests", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "comment-1" })));
    const client = clientWithFetch(fetchImpl);

    await client.addCardComment("card 1", "Hello");

    const [url, init] = firstFetchCall(fetchImpl);
    expect(String(url)).toContain("/cards/card%201/actions/comments");
    expect(new URL(String(url)).searchParams.get("text")).toBe("Hello");
    expect(init).toMatchObject({ method: "POST" });
  });

  it("constructs description update requests", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "card-1" })));
    const client = clientWithFetch(fetchImpl);

    await client.updateCardDescription("card-1", "New description");

    const [url, init] = firstFetchCall(fetchImpl);
    expect(String(url)).toContain("/cards/card-1");
    expect(new URL(String(url)).searchParams.get("desc")).toBe("New description");
    expect(init).toMatchObject({ method: "PUT" });
  });

  it("constructs custom field update requests with JSON body", async () => {
    const fetchImpl = vi.fn(async () => new Response(""));
    const client = clientWithFetch(fetchImpl);

    await client.updateCardCustomField("card-1", "field-1", { value: { text: "Ready" } });

    const [url, init] = firstFetchCall(fetchImpl);
    expect(String(url)).toContain("/cards/card-1/customField/field-1/item");
    expect(init).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ value: { text: "Ready" } })
    });
  });

  it("constructs custom field clear requests", async () => {
    const fetchImpl = vi.fn(async () => new Response(""));
    const client = clientWithFetch(fetchImpl);

    await client.clearCardCustomField("card-1", "field-1");

    const [url, init] = firstFetchCall(fetchImpl);
    expect(String(url)).toContain("/cards/card-1/customField/field-1/item");
    expect(init).toMatchObject({ method: "DELETE" });
  });

  it("constructs add label requests", async () => {
    const fetchImpl = vi.fn(async () => new Response(""));
    const client = clientWithFetch(fetchImpl);

    await client.addCardLabel("card-1", "label-1");

    const [url, init] = firstFetchCall(fetchImpl);
    expect(String(url)).toContain("/cards/card-1/idLabels");
    expect(new URL(String(url)).searchParams.get("value")).toBe("label-1");
    expect(init).toMatchObject({ method: "POST" });
  });

  it("constructs remove label requests", async () => {
    const fetchImpl = vi.fn(async () => new Response(""));
    const client = clientWithFetch(fetchImpl);

    await client.removeCardLabel("card-1", "label-1");

    const [url, init] = firstFetchCall(fetchImpl);
    expect(String(url)).toContain("/cards/card-1/idLabels/label-1");
    expect(init).toMatchObject({ method: "DELETE" });
  });
});
