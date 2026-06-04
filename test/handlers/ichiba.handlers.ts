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
const ICHIBA_GENRE_SEARCH_URL =
  "https://app.rakuten.co.jp/services/api/IchibaGenre/Search/20140222";
const ICHIBA_TAG_SEARCH_URL =
  "https://app.rakuten.co.jp/services/api/IchibaTag/Search/20140222";
const ICHIBA_ITEM_RANKING_URL =
  "https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20220601";
const ICHIBA_PRODUCT_SEARCH_URL =
  "https://app.rakuten.co.jp/services/api/Product/Search/20170426";

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

// ──────────────────────────────────────────────────────────────────────────────
// Genre Search handlers
// ──────────────────────────────────────────────────────────────────────────────

export function genreSearchTop() {
  return http.get(ICHIBA_GENRE_SEARCH_URL, () => {
    return HttpResponse.json(loadFixture("genre_search_top.json"));
  });
}

export function genreSearchNested() {
  return http.get(ICHIBA_GENRE_SEARCH_URL, () => {
    return HttpResponse.json(loadFixture("genre_search_nested.json"));
  });
}

export function genreSearchAuthInvalid() {
  return http.get(ICHIBA_GENRE_SEARCH_URL, () => {
    return HttpResponse.json(
      { error: "wrong_parameter", error_description: "specify valid applicationId" },
      { status: 400 },
    );
  });
}

export function genreSearchServerError() {
  return http.get(ICHIBA_GENRE_SEARCH_URL, () => {
    return HttpResponse.json(
      { error: "server_error", error_description: "internal server error" },
      { status: 500 },
    );
  });
}

export function genreSearchRateLimitedThenSuccess(failFor: number) {
  let count = 0;
  return http.get(ICHIBA_GENRE_SEARCH_URL, () => {
    count++;
    if (count <= failFor) {
      return HttpResponse.json(
        { error: "too_many_requests", error_description: "rate limit exceeded" },
        { status: 429 },
      );
    }
    return HttpResponse.json(loadFixture("genre_search_top.json"));
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Tag Search handlers
// ──────────────────────────────────────────────────────────────────────────────

export function tagSearchSuccess() {
  return http.get(ICHIBA_TAG_SEARCH_URL, () => {
    return HttpResponse.json(loadFixture("tag_search_success.json"));
  });
}

export function tagSearchAuthInvalid() {
  return http.get(ICHIBA_TAG_SEARCH_URL, () => {
    return HttpResponse.json(
      { error: "wrong_parameter", error_description: "specify valid applicationId" },
      { status: 400 },
    );
  });
}

export function tagSearchServerError() {
  return http.get(ICHIBA_TAG_SEARCH_URL, () => {
    return HttpResponse.json(
      { error: "server_error", error_description: "internal server error" },
      { status: 500 },
    );
  });
}

export function tagSearchRateLimitedThenSuccess(failFor: number) {
  let count = 0;
  return http.get(ICHIBA_TAG_SEARCH_URL, () => {
    count++;
    if (count <= failFor) {
      return HttpResponse.json(
        { error: "too_many_requests", error_description: "rate limit exceeded" },
        { status: 429 },
      );
    }
    return HttpResponse.json(loadFixture("tag_search_success.json"));
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Item Ranking handlers
// ──────────────────────────────────────────────────────────────────────────────

export function itemRankingSuccess() {
  return http.get(ICHIBA_ITEM_RANKING_URL, () => {
    return HttpResponse.json(loadFixture("item_ranking_success.json"));
  });
}

export function itemRankingAuthInvalid() {
  return http.get(ICHIBA_ITEM_RANKING_URL, () => {
    return HttpResponse.json(
      { error: "wrong_parameter", error_description: "specify valid applicationId" },
      { status: 400 },
    );
  });
}

export function itemRankingServerError() {
  return http.get(ICHIBA_ITEM_RANKING_URL, () => {
    return HttpResponse.json(
      { error: "server_error", error_description: "internal server error" },
      { status: 500 },
    );
  });
}

export function itemRankingRateLimitedThenSuccess(failFor: number) {
  let count = 0;
  return http.get(ICHIBA_ITEM_RANKING_URL, () => {
    count++;
    if (count <= failFor) {
      return HttpResponse.json(
        { error: "too_many_requests", error_description: "rate limit exceeded" },
        { status: 429 },
      );
    }
    return HttpResponse.json(loadFixture("item_ranking_success.json"));
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Product Search handlers (Item Price Navi)
// ──────────────────────────────────────────────────────────────────────────────

export function productSearchSuccess() {
  return http.get(ICHIBA_PRODUCT_SEARCH_URL, () => {
    return HttpResponse.json(loadFixture("product_search_success.json"));
  });
}

export function productSearchAuthInvalid() {
  return http.get(ICHIBA_PRODUCT_SEARCH_URL, () => {
    return HttpResponse.json(
      { error: "wrong_parameter", error_description: "specify valid applicationId" },
      { status: 400 },
    );
  });
}

export function productSearchServerError() {
  return http.get(ICHIBA_PRODUCT_SEARCH_URL, () => {
    return HttpResponse.json(
      { error: "server_error", error_description: "internal server error" },
      { status: 500 },
    );
  });
}

export function productSearchRateLimitedThenSuccess(failFor: number) {
  let count = 0;
  return http.get(ICHIBA_PRODUCT_SEARCH_URL, () => {
    count++;
    if (count <= failFor) {
      return HttpResponse.json(
        { error: "too_many_requests", error_description: "rate limit exceeded" },
        { status: 429 },
      );
    }
    return HttpResponse.json(loadFixture("product_search_success.json"));
  });
}
