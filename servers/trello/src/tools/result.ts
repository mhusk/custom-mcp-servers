import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { logger } from "../utils/logger.js";
import { toPublicError } from "../utils/errors.js";

export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

export function errorResult(error: unknown): CallToolResult {
  const publicError = toPublicError(error);
  logger.error(publicError.message, { code: publicError.code });

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(publicError, null, 2)
      }
    ]
  };
}

export async function safeTool(handler: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return jsonResult(await handler());
  } catch (error) {
    return errorResult(error);
  }
}
