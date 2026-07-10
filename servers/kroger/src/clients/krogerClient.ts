import type {
  CartItem,
  KrogerEnvelope,
  KrogerLocation,
  KrogerProduct,
  LocationSearch,
  ProductSearch
} from "../types/kroger.js";
import { KrogerApiError } from "../utils/errors.js";

export type KrogerClientOptions = {
  accessToken: string;
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type QueryValue = string | number | undefined;

export class KrogerClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: KrogerClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async searchLocations(search: LocationSearch): Promise<KrogerEnvelope<KrogerLocation[]>> {
    return this.request("/locations", {
      "filter.zipCode.near": search.zipCode,
      "filter.latLong.near": search.latLong,
      "filter.lat.near": search.latitude,
      "filter.lon.near": search.longitude,
      "filter.radiusInMiles": search.radiusInMiles,
      "filter.limit": search.limit,
      "filter.chain": search.chain,
      "filter.department": search.departments?.join(",")
    });
  }

  async getLocation(locationId: string): Promise<KrogerEnvelope<KrogerLocation>> {
    return this.request(`/locations/${encodeURIComponent(locationId)}`);
  }

  async searchProducts(search: ProductSearch): Promise<KrogerEnvelope<KrogerProduct[]>> {
    return this.request("/products", {
      "filter.term": search.term,
      "filter.locationId": search.locationId,
      "filter.brand": search.brand,
      "filter.fulfillment": search.fulfillment?.join(","),
      "filter.start": search.start,
      "filter.limit": search.limit
    });
  }

  async getProduct(id: string, locationId?: string): Promise<KrogerEnvelope<KrogerProduct>> {
    return this.request(`/products/${encodeURIComponent(id)}`, {
      "filter.locationId": locationId
    });
  }

  async addToCart(
    items: CartItem[]
  ): Promise<{ success: true; addedItemCount: number; items: CartItem[] }> {
    await this.request("/cart/add", {}, { method: "PUT", body: { items }, allowEmpty: true });
    return { success: true, addedItemCount: items.length, items };
  }

  private async request<T>(
    path: string,
    query: Record<string, QueryValue> = {},
    options: { method?: "GET" | "PUT"; body?: unknown; allowEmpty?: boolean } = {}
  ): Promise<T> {
    const url = new URL(`${this.options.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: options.method ?? "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.options.accessToken}`,
          ...(options.body === undefined ? {} : { "Content-Type": "application/json" })
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
      });

      if (!response.ok) this.throwResponseError(response);
      if (response.status === 204 || response.headers.get("content-length") === "0") {
        if (options.allowEmpty) return undefined as T;
        throw new KrogerApiError(
          "Kroger API returned an empty response.",
          "KROGER_INVALID_RESPONSE",
          502
        );
      }

      const text = await response.text();
      if (text.trim() === "") {
        if (options.allowEmpty) return undefined as T;
        throw new KrogerApiError(
          "Kroger API returned an empty response.",
          "KROGER_INVALID_RESPONSE",
          502
        );
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new KrogerApiError(
          "Kroger API returned malformed JSON.",
          "KROGER_INVALID_RESPONSE",
          502
        );
      }
    } catch (error) {
      if (error instanceof KrogerApiError) throw error;
      if (isAbortError(error)) {
        throw new KrogerApiError("Kroger API request timed out.", "KROGER_TIMEOUT");
      }
      throw new KrogerApiError("Kroger API is unavailable.", "KROGER_UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
  }

  private throwResponseError(response: Response): never {
    if (response.status === 401 || response.status === 403) {
      throw new KrogerApiError(
        "Kroger authentication failed or the access token expired. Replace KROGER_ACCESS_TOKEN in Codex Desktop, then restart or reconnect this MCP server.",
        "KROGER_AUTH_FAILED",
        response.status
      );
    }
    if (response.status === 404) {
      throw new KrogerApiError("Requested Kroger resource was not found.", "KROGER_NOT_FOUND", 404);
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const suffix = retryAfter ? ` Retry after ${retryAfter} seconds.` : "";
      throw new KrogerApiError(
        `Kroger API rate limit reached.${suffix}`,
        "KROGER_RATE_LIMITED",
        429
      );
    }
    if (response.status >= 500) {
      throw new KrogerApiError(
        "Kroger API is temporarily unavailable.",
        "KROGER_UNAVAILABLE",
        response.status
      );
    }
    throw new KrogerApiError(
      `Kroger API rejected the request with HTTP ${response.status}.`,
      "KROGER_REQUEST_FAILED",
      response.status
    );
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}
