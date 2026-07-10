import { describe, expect, it, vi } from "vitest";

import type { KrogerClient } from "../../src/clients/krogerClient.js";
import { KrogerService } from "../../src/services/krogerService.js";

function mockClient() {
  return {
    searchProducts: vi.fn(async () => ({ data: [] })),
    getProduct: vi.fn(async () => ({ data: {} })),
    searchLocations: vi.fn(async () => ({ data: [] })),
    getLocation: vi.fn(async () => ({ data: {} })),
    addToCart: vi.fn(async () => ({ success: true as const, addedItemCount: 0, items: [] }))
  };
}

describe("KrogerService location resolution", () => {
  it("uses the configured default location", async () => {
    const client = mockClient();
    const service = new KrogerService(client as unknown as KrogerClient, "default-store");
    await service.searchProducts({ term: "milk" });
    await service.getProduct("upc");
    expect(client.searchProducts).toHaveBeenCalledWith({
      term: "milk",
      locationId: "default-store"
    });
    expect(client.getProduct).toHaveBeenCalledWith("upc", "default-store");
  });

  it("prefers explicit location overrides", async () => {
    const client = mockClient();
    const service = new KrogerService(client as unknown as KrogerClient, "default-store");
    await service.searchProducts({ term: "milk", locationId: "other-store" });
    await service.getProduct("upc", "other-store");
    expect(client.searchProducts).toHaveBeenCalledWith({ term: "milk", locationId: "other-store" });
    expect(client.getProduct).toHaveBeenCalledWith("upc", "other-store");
  });
});
