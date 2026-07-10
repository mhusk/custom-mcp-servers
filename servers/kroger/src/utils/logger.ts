export type Logger = {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
};

function write(level: string, message: string, metadata?: Record<string, unknown>): void {
  const payload = metadata ? ` ${JSON.stringify(metadata)}` : "";
  process.stderr.write(`[kroger-mcp] ${level} ${message}${payload}\n`);
}

export const logger: Logger = {
  debug: (message, metadata) => {
    if (process.env.LOG_LEVEL === "debug") write("debug", message, metadata);
  },
  info: (message, metadata) => write("info", message, metadata),
  warn: (message, metadata) => write("warn", message, metadata),
  error: (message, metadata) => write("error", message, metadata)
};
