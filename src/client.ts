/**
 * Rakuten API request client.
 *
 * Handles:
 *   - per-endpoint host selection (legacy app.rakuten.co.jp vs new openapi.rakuten.co.jp)
 *   - auth-param injection (applicationId, accessKey, optional affiliateId)
 *   - retry with exponential backoff on 429 + 5xx
 *   - Retry-After header parsing (numeric seconds AND HTTP-date)
 *   - typed error mapping (both legacy and new response shapes)
 *
 * Endpoint host config is owned by each tool file (per-endpoint, not blanket).
 * A `RAKUTEN_API_HOST_OVERRIDE` env var can force every request through a single
 * host as an escape hatch.
 */

import { appendAuthParams } from "./auth.js";
import type { Config } from "./config.js";
import { parseRakutenError, RakutenMalformedResponseError, RakutenRateLimitError } from "./errors.js";

export interface RakutenRequestOpts {
  /** Base host, e.g. HOST_LEGACY or HOST_OPENAPI. Use the constant from config.ts. */
  host: string;
  /** Path on the host, e.g. "/services/api/IchibaItem/Search/20220601". */
  path: string;
  /** Query parameters in addition to auth. */
  params?: Record<string, string>;
}

interface RawResponse {
  status: number;
  retryAfter: string | null;
  body: unknown;
}

const DEFAULT_BACKOFF_MS = [500, 1000, 2000, 4000]; // ms — index-aligned with attempt number

export async function rakutenRequest<T = unknown>(opts: RakutenRequestOpts, config: Config): Promise<T> {
  const host = config.hostOverride ?? opts.host;
  const params = new URLSearchParams();
  params.set("format", "json");
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined && v !== null && v !== "") {
        params.set(k, v);
      }
    }
  }
  appendAuthParams(params, config);

  const url = `${host}${opts.path}?${params.toString()}`;

  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= config.maxRetries) {
    try {
      const raw = await fetchOnce(url);
      if (raw.status >= 200 && raw.status < 300) {
        return raw.body as T;
      }

      const err = parseRakutenError(raw.status, raw.body, raw.retryAfter);

      // Only retry on rate-limit and server errors
      if (err instanceof RakutenRateLimitError || (raw.status >= 500 && raw.status < 600)) {
        lastErr = err;
        const waitMs = err instanceof RakutenRateLimitError && err.retryAfterMs !== undefined
          ? Math.min(err.retryAfterMs, 60_000)
          : DEFAULT_BACKOFF_MS[Math.min(attempt, DEFAULT_BACKOFF_MS.length - 1)];
        attempt++;
        if (attempt > config.maxRetries) break;
        await sleep(waitMs);
        continue;
      }

      // Non-retryable error
      throw err;
    } catch (err) {
      // Network errors (fetch threw before getting a response) — retryable
      if (err instanceof TypeError && attempt < config.maxRetries) {
        lastErr = err;
        const waitMs = DEFAULT_BACKOFF_MS[Math.min(attempt, DEFAULT_BACKOFF_MS.length - 1)];
        attempt++;
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }

  // Exhausted retries
  if (lastErr) throw lastErr;
  throw new RakutenMalformedResponseError(undefined);
}

async function fetchOnce(url: string): Promise<RawResponse> {
  const resp = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "rakuten-mcp/1.0",
    },
  });

  const retryAfter = resp.headers.get("retry-after");
  const text = await resp.text();
  let body: unknown;
  if (text.length === 0) {
    body = null;
  } else {
    try {
      body = JSON.parse(text);
    } catch {
      throw new RakutenMalformedResponseError(text);
    }
  }

  return { status: resp.status, retryAfter, body };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
