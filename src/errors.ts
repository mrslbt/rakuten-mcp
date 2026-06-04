/**
 * Typed errors mapped from Rakuten API responses.
 *
 * Two response shapes exist in the wild:
 *   Legacy host (app.rakuten.co.jp):
 *     { "error_description": "...", "error": "wrong_parameter" }
 *   New host (openapi.rakuten.co.jp):
 *     { "errors": { "errorCode": 400, "errorMessage": "..." } }
 *
 * `parseRakutenError` normalizes both into the same typed error tree.
 */

import { errorMessages } from "./i18n.js";

export abstract class RakutenError extends Error {
  abstract readonly code: string;
  /** Original HTTP status from Rakuten. */
  readonly httpStatus: number;
  /** Original error body from Rakuten (for debugging). */
  readonly originalBody?: unknown;
  /** Suggested user-facing message in EN and JA. */
  readonly messageJa: string;

  constructor(opts: { httpStatus: number; messageEn: string; messageJa: string; originalBody?: unknown }) {
    super(opts.messageEn);
    this.name = this.constructor.name;
    this.httpStatus = opts.httpStatus;
    this.messageJa = opts.messageJa;
    this.originalBody = opts.originalBody;
  }

  /** Tool-handler-friendly string: bilingual one-liner. */
  toToolError(): string {
    return `${this.message}\n\n[JA] ${this.messageJa}`;
  }
}

export class RakutenConfigError extends RakutenError {
  readonly code = "config_error";
  constructor() {
    super({
      httpStatus: 0,
      messageEn: errorMessages.configMissing.en,
      messageJa: errorMessages.configMissing.ja,
    });
  }
}

export class RakutenAuthError extends RakutenError {
  readonly code = "auth_invalid";
  constructor(httpStatus: number, originalBody?: unknown) {
    super({
      httpStatus,
      messageEn: errorMessages.authInvalid.en,
      messageJa: errorMessages.authInvalid.ja,
      originalBody,
    });
  }
}

export class RakutenRateLimitError extends RakutenError {
  readonly code = "rate_limited";
  /** Parsed Retry-After value in milliseconds, when available. */
  readonly retryAfterMs?: number;
  constructor(opts: { httpStatus: number; retryAfterMs?: number; originalBody?: unknown }) {
    super({
      httpStatus: opts.httpStatus,
      messageEn: errorMessages.rateLimited.en,
      messageJa: errorMessages.rateLimited.ja,
      originalBody: opts.originalBody,
    });
    this.retryAfterMs = opts.retryAfterMs;
  }
}

export class RakutenServerError extends RakutenError {
  readonly code = "server_error";
  constructor(httpStatus: number, originalBody?: unknown) {
    super({
      httpStatus,
      messageEn: errorMessages.serverError.en,
      messageJa: errorMessages.serverError.ja,
      originalBody,
    });
  }
}

export class RakutenNotFoundError extends RakutenError {
  readonly code = "not_found";
  constructor(httpStatus: number, originalBody?: unknown) {
    super({
      httpStatus,
      messageEn: errorMessages.notFound.en,
      messageJa: errorMessages.notFound.ja,
      originalBody,
    });
  }
}

export class RakutenBadRequestError extends RakutenError {
  readonly code = "bad_request";
  constructor(httpStatus: number, originalMessage: string, originalBody?: unknown) {
    super({
      httpStatus,
      messageEn: `Rakuten API rejected the request: ${originalMessage}`,
      messageJa: `Rakuten API がリクエストを拒否しました: ${originalMessage}`,
      originalBody,
    });
  }
}

export class RakutenMalformedResponseError extends RakutenError {
  readonly code = "malformed_response";
  constructor(originalBody?: unknown) {
    super({
      httpStatus: 0,
      messageEn: errorMessages.malformedResponse.en,
      messageJa: errorMessages.malformedResponse.ja,
      originalBody,
    });
  }
}

export class RakutenUnknownError extends RakutenError {
  readonly code = "unknown";
  constructor(httpStatus: number, originalBody?: unknown) {
    super({
      httpStatus,
      messageEn: errorMessages.unknown.en,
      messageJa: errorMessages.unknown.ja,
      originalBody,
    });
  }
}

/**
 * Parse a Rakuten error response (either format) into a typed error.
 *
 * Handles both:
 *   { error_description, error }         — legacy host
 *   { errors: { errorCode, errorMessage } } — new host
 */
export function parseRakutenError(status: number, body: unknown, retryAfter?: string | null): RakutenError {
  // Try to extract a human-readable message from either response shape.
  let originalMessage = "";
  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    if (typeof b.error_description === "string") {
      originalMessage = b.error_description;
    } else if (typeof b.errors === "object" && b.errors !== null) {
      const errs = b.errors as Record<string, unknown>;
      if (typeof errs.errorMessage === "string") {
        originalMessage = errs.errorMessage;
      }
    }
  }

  switch (status) {
    case 400:
      return new RakutenBadRequestError(status, originalMessage || "(no detail)", body);
    case 401:
    case 403:
      return new RakutenAuthError(status, body);
    case 404:
      return new RakutenNotFoundError(status, body);
    case 429: {
      const retryAfterMs = parseRetryAfter(retryAfter);
      return new RakutenRateLimitError({ httpStatus: status, retryAfterMs, originalBody: body });
    }
    case 500:
    case 502:
    case 503:
    case 504:
      return new RakutenServerError(status, body);
    default:
      return new RakutenUnknownError(status, body);
  }
}

/**
 * Parse a Retry-After header value (either seconds or HTTP-date) into milliseconds.
 */
export function parseRetryAfter(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const asNumber = Number(value);
  if (!Number.isNaN(asNumber)) {
    return asNumber * 1000;
  }
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    const deltaMs = dateMs - Date.now();
    return deltaMs > 0 ? deltaMs : 0;
  }
  return undefined;
}
