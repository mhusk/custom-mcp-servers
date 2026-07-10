import { describe, expect, it } from "vitest";
import { z } from "zod";

import { KrogerApiError, toPublicError } from "../../src/utils/errors.js";

describe("toPublicError", () => {
  it("preserves known public errors", () => {
    expect(toPublicError(new KrogerApiError("Safe", "SAFE"))).toEqual({
      code: "SAFE",
      message: "Safe"
    });
  });

  it("maps validation errors without input values", () => {
    let error: unknown;
    try {
      z.object({ token: z.string().min(20) }).parse({ token: "secret" });
    } catch (caught) {
      error = caught;
    }
    const result = toPublicError(error);
    expect(result.code).toBe("VALIDATION_ERROR");
    expect(result.message).not.toContain("secret");
  });

  it("redacts unknown errors", () => {
    const result = toPublicError(new Error("Bearer secret-token"));
    expect(result).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected internal error occurred."
    });
  });
});
