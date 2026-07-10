import { describe, expect, it, vi } from "vitest";

import { KrogerClient } from "../../src/clients/krogerClient.js";

function clientWithFetch(fetchImpl: ReturnType<typeof vi.fn>, timeoutMs?: number): KrogerClient {
  return new KrogerClient({
    accessToken: "super-secret-token",
    baseUrl: "https://api.kroger.test/v1",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    timeoutMs
  });
}

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

function firstCall(fetchImpl: ReturnType<typeof vi.fn>): [URL, RequestInit] {
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
  return [url, init];
}

describe("KrogerClient requests", () => {
  it("sends bearer auth and location filters", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [] }));
    const client = clientWithFetch(fetchImpl);

    await client.searchLocations({
      zipCode: "48201",
      radiusInMiles: 25,
      limit: 5,
      chain: "Kroger",
      departments: ["01", "02"]
    });

    const [url, init] = firstCall(fetchImpl);
    expect(url.pathname).toBe("/v1/locations");
    expect(url.searchParams.get("filter.zipCode.near")).toBe("48201");
    expect(url.searchParams.get("filter.radiusInMiles")).toBe("25");
    expect(url.searchParams.get("filter.department")).toBe("01,02");
    expect(init.headers).toMatchObject({ Authorization: "Bearer super-secret-token" });
  });

  it("encodes product IDs and constructs product filters", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [] }));
    const client = clientWithFetch(fetchImpl);

    await client.searchProducts({
      term: "ice cream",
      locationId: "store 1",
      brand: "Private Selection",
      fulfillment: ["csp", "dth"],
      start: 10,
      limit: 20
    });
    let [url] = firstCall(fetchImpl);
    expect(url.searchParams.get("filter.term")).toBe("ice cream");
    expect(url.searchParams.get("filter.locationId")).toBe("store 1");
    expect(url.searchParams.get("filter.fulfillment")).toBe("csp,dth");

    await client.getProduct("product/one", "store-1");
    [url] = fetchImpl.mock.calls[1] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/v1/products/product%2Fone");
  });

  it("preserves leading-zero UPCs in one cart batch and accepts 204", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const client = clientWithFetch(fetchImpl);
    const items = [
      { upc: "0001111040101", quantity: 2, modality: "PICKUP" },
      { upc: "0012345678905", quantity: 1, modality: "DELIVERY" }
    ];

    await expect(client.addToCart(items)).resolves.toEqual({
      success: true,
      addedItemCount: 2,
      items
    });
    const [url, init] = firstCall(fetchImpl);
    expect(url.pathname).toBe("/v1/cart/add");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ items });
  });
});

describe("KrogerClient error mapping", () => {
  it.each([401, 403])("maps HTTP %s to actionable authentication failure", async (status) => {
    const client = clientWithFetch(vi.fn(async () => new Response("secret", { status })));
    await expect(client.getLocation("store")).rejects.toMatchObject({
      code: "KROGER_AUTH_FAILED",
      message: expect.stringContaining("KROGER_ACCESS_TOKEN")
    });
  });

  it("maps not found, rate limits, request failures, and outages", async () => {
    await expect(
      clientWithFetch(vi.fn(async () => new Response("", { status: 404 }))).getLocation("x")
    ).rejects.toMatchObject({ code: "KROGER_NOT_FOUND" });

    await expect(
      clientWithFetch(
        vi.fn(async () => new Response("", { status: 429, headers: { "Retry-After": "30" } }))
      ).getLocation("x")
    ).rejects.toMatchObject({
      code: "KROGER_RATE_LIMITED",
      message: expect.stringContaining("30")
    });

    await expect(
      clientWithFetch(
        vi.fn(async () => new Response("Bearer super-secret-token", { status: 400 }))
      ).getLocation("x")
    ).rejects.toMatchObject({
      code: "KROGER_REQUEST_FAILED",
      message: expect.not.stringContaining("super-secret-token")
    });

    await expect(
      clientWithFetch(vi.fn(async () => new Response("", { status: 503 }))).getLocation("x")
    ).rejects.toMatchObject({ code: "KROGER_UNAVAILABLE" });
  });

  it("rejects malformed and unexpected empty responses", async () => {
    await expect(
      clientWithFetch(vi.fn(async () => new Response("not-json"))).getLocation("x")
    ).rejects.toMatchObject({ code: "KROGER_INVALID_RESPONSE" });
    await expect(
      clientWithFetch(vi.fn(async () => new Response(""))).getLocation("x")
    ).rejects.toMatchObject({ code: "KROGER_INVALID_RESPONSE" });
  });

  it("maps network failures and request timeouts", async () => {
    await expect(
      clientWithFetch(vi.fn(async () => Promise.reject(new Error("network secret")))).getLocation(
        "x"
      )
    ).rejects.toMatchObject({ code: "KROGER_UNAVAILABLE" });

    const fetchImpl = vi.fn(
      async (_url: URL, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })
    );
    await expect(clientWithFetch(fetchImpl, 1).getLocation("x")).rejects.toMatchObject({
      code: "KROGER_TIMEOUT"
    });
  });
});
