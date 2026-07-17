export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ConfigError extends AppError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class TrelloApiError extends AppError {
  constructor(message: string, code: string, statusCode?: number) {
    super(message, code, statusCode);
    this.name = "TrelloApiError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code = "NOT_FOUND") {
    super(message, code, 404);
    this.name = "NotFoundError";
  }
}

export class AccessDeniedError extends AppError {
  constructor(message: string) {
    super(message, "TRELLO_BOARD_ACCESS_DENIED", 403);
    this.name = "AccessDeniedError";
  }
}

export class MutationVerificationError extends AppError {
  constructor(message: string) {
    super(message, "TRELLO_MUTATION_NOT_APPLIED", 502);
    this.name = "MutationVerificationError";
  }
}

export function toPublicError(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected internal error occurred."
  };
}
