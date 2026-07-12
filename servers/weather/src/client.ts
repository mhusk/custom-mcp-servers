import { z } from "zod";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}
export type Fetcher = typeof fetch;
export class OpenMeteoClient {
  constructor(
    private readonly options: {
      geocodingBaseUrl: string;
      forecastBaseUrl: string;
      timeoutMs: number;
      fetcher?: Fetcher;
    }
  ) {}
  async geocode(params: Record<string, string | number>): Promise<unknown> {
    return this.get(`${this.options.geocodingBaseUrl}/search`, params);
  }
  async forecast(params: Record<string, string | number>): Promise<unknown> {
    return this.get(`${this.options.forecastBaseUrl}/forecast`, params);
  }
  private async get(base: string, params: Record<string, string | number>): Promise<unknown> {
    const url = new URL(base);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    let response: Response;
    try {
      response = await (this.options.fetcher ?? fetch)(url, {
        headers: { "User-Agent": "@custom-mcp/weather/0.1.0" },
        signal: AbortSignal.timeout(this.options.timeoutMs)
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
        throw new ProviderError(
          `Open-Meteo request timed out after ${this.options.timeoutMs} ms`,
          "TIMEOUT"
        );
      throw new ProviderError("Open-Meteo network request failed; retry later", "NETWORK");
    }
    if (!response.ok) {
      const retry = response.headers.get("retry-after");
      if (response.status === 429)
        throw new ProviderError(
          `Open-Meteo rate limit reached${retry ? `; retry after ${retry}` : "; retry later"}`,
          "RATE_LIMIT"
        );
      throw new ProviderError(`Open-Meteo returned HTTP ${response.status}; retry later`, "HTTP");
    }
    try {
      return await response.json();
    } catch {
      throw new ProviderError("Open-Meteo returned invalid JSON", "INVALID_JSON");
    }
  }
}
export const finiteNumber = z.number().finite();
