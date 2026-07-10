import { describe, expect, it } from "vitest";

import { KrogerApiError } from "../../src/utils/errors.js";
import { safeTool } from "../../src/tools/result.js";

describe("safeTool", () => {
  it("returns normalized JSON success and errors", async () => {
    await expect(safeTool(async () => ({ success: true }))).resolves.toMatchObject({
      content: [{ type: "text", text: '{\n  "success": true\n}' }]
    });
    await expect(
      safeTool(async () => Promise.reject(new KrogerApiError("Nope", "KROGER_ERROR")))
    ).resolves.toMatchObject({
      isError: true,
      content: [{ type: "text", text: expect.stringContaining("KROGER_ERROR") }]
    });
  });
});
