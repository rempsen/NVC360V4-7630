/**
 * Typed application errors + a single sanitized error envelope.
 * Routes throw AppError; the global onError handler turns it into a
 * consistent JSON shape and never leaks stack traces to clients.
 */

export class AppError extends Error {
  status: number;
  code: string;
  expose: boolean;
  details?: unknown;
  constructor(
    status: number,
    code: string,
    message: string,
    opts?: { expose?: boolean; details?: unknown },
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    // 4xx messages are safe to show; 5xx are masked unless explicitly exposed
    this.expose = opts?.expose ?? status < 500;
    this.details = opts?.details;
  }
}

export const Err = {
  badRequest: (msg = "Bad request", details?: unknown) =>
    new AppError(400, "bad_request", msg, { details }),
  unauthorized: (msg = "Unauthorized") => new AppError(401, "unauthorized", msg),
  forbidden: (msg = "Forbidden") => new AppError(403, "forbidden", msg),
  notFound: (msg = "Not found") => new AppError(404, "not_found", msg),
  conflict: (msg = "Conflict", details?: unknown) =>
    new AppError(409, "conflict", msg, { details }),
  tooMany: (msg = "Too many requests") => new AppError(429, "rate_limited", msg),
  internal: (msg = "Internal server error") =>
    new AppError(500, "internal", msg, { expose: false }),
};
