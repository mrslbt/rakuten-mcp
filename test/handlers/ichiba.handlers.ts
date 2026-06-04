/**
 * msw handlers for Ichiba endpoints.
 *
 * Each handler is a factory: it accepts options (which fixture to serve, what
 * status to return, etc.) and returns a single msw HttpHandler. Tests opt in
 * to the scenarios they need via `server.use(...)`.
 */

import { http, HttpResponse } from "msw";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "fixtures", "ichiba");

function loadFixture(name: string): unknown {
  const path = join(FIXTURES, name);
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

const ICHIBA_ITEM_SEARCH_URL =
  "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";

// ──────────────────────────────────────────────────────────────────────────────
// Success / no-results
// ──────────────────────────────────────────────────────────────────────────────

export function itemSearchSuccess() {
  return http.get(ICHIBA_ITEM_SEARCH_URL, () => {
    return HttpResponse.json(loadFixture("item_search_success.json"));
  });
}

export function itemSearchEmpty() {
  return http.get(ICHIBA_ITEM_SEARCH_URL, () => {
    return HttpResponse.json(loadFixture("item_search_empty.json"));
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Error scenarios — emit Rakuten's legacy-host error shape
// ──────────────────────────────────────────────────────────────────────────────

export function itemSearchAuthInvalid() {
  return http.get(ICHIBA_ITEM_SEARCH_URL, () => {
    return HttpResponse.json(
      {
        error: "wrong_parameter",
        error_description: "specify valid applicationId",
      },
      { status: 400 },
    );
  });
}

export function itemSearchUnauthorized() {
  return http.get(ICHIBA_ITEM_SEARCH_URL, () => {
    return HttpResponse.json(
      {
        error: "invalid_token",
        error_description: "invalid access token",
      },
      { status: 401 },
    );
  });
}

export function itemSearchServerError() {
  return http.get(ICHIBA_ITEM_SEARCH_URL, () => {
    return HttpResponse.json(
      { error: "server_error", error_description: "internal server error" },
      { status: 500 },
    );
  });
}

/**
 * Returns 429 the first `failFor` times, then 200 with success fixture.
 * Lets tests verify retry-with-backoff actually works.
 */
export function itemSearchRateLimitedThenSuccess(failFor: number, retryAfterSeconds = 0) {
  let count = 0;
  return http.get(ICHIBA_ITEM_SEARCH_URL, () => {
    count++;
    if (count <= failFor) {
      return HttpResponse.json(
        { error: "too_many_requests", error_description: "rate limit exceeded" },
        {
          status: 429,
          headers: retryAfterSeconds > 0 ? { "Retry-After": String(retryAfterSeconds) } : {},
        },
      );
    }
    return HttpResponse.json(loadFixture("item_search_success.json"));
  });
}
