/**
 * msw handlers for Books endpoints.
 *
 * Pattern mirrors test/handlers/ichiba.handlers.ts: factory functions return
 * a single HttpHandler keyed to one fixture or error scenario.
 */

import { http, HttpResponse } from "msw";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "fixtures", "books");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

const URLS = {
  total:     "https://openapi.rakuten.co.jp/services/api/BooksTotal/Search/20170404",
  book:      "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404",
  cd:        "https://openapi.rakuten.co.jp/services/api/BooksCD/Search/20170404",
  dvd:       "https://openapi.rakuten.co.jp/services/api/BooksDVD/Search/20170404",
  foreign:   "https://openapi.rakuten.co.jp/services/api/BooksForeignBook/Search/20170404",
  magazine:  "https://openapi.rakuten.co.jp/services/api/BooksMagazine/Search/20170404",
  game:      "https://openapi.rakuten.co.jp/services/api/BooksGame/Search/20170404",
  software:  "https://openapi.rakuten.co.jp/services/api/BooksSoftware/Search/20170404",
  genre:     "https://openapi.rakuten.co.jp/services/api/BooksGenre/Search/20121128",
};

function makeSuccess(url: string, fixture: string) {
  return () => http.get(url, () => HttpResponse.json(loadFixture(fixture)));
}

function makeAuthInvalid(url: string) {
  return () =>
    http.get(url, () =>
      HttpResponse.json(
        { error: "wrong_parameter", error_description: "specify valid applicationId" },
        { status: 400 },
      ),
    );
}

function makeServerError(url: string) {
  return () =>
    http.get(url, () =>
      HttpResponse.json(
        { error: "server_error", error_description: "internal server error" },
        { status: 500 },
      ),
    );
}

function makeRateLimitedThenSuccess(url: string, fixture: string) {
  return (failFor: number) => {
    let count = 0;
    return http.get(url, () => {
      count++;
      if (count <= failFor) {
        return HttpResponse.json(
          { error: "too_many_requests", error_description: "rate limit exceeded" },
          { status: 429 },
        );
      }
      return HttpResponse.json(loadFixture(fixture));
    });
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-endpoint exports
// ──────────────────────────────────────────────────────────────────────────────

export const booksTotalSearchSuccess = makeSuccess(URLS.total, "books_total_search_success.json");
export const booksTotalSearchEmpty   = makeSuccess(URLS.total, "books_total_search_empty.json");
export const booksTotalSearchAuthInvalid = makeAuthInvalid(URLS.total);
export const booksTotalSearchServerError = makeServerError(URLS.total);
export const booksTotalSearchRateLimitedThenSuccess = makeRateLimitedThenSuccess(URLS.total, "books_total_search_success.json");

export const booksBookSearchSuccess = makeSuccess(URLS.book, "books_book_search_success.json");
export const booksBookSearchAuthInvalid = makeAuthInvalid(URLS.book);
export const booksBookSearchServerError = makeServerError(URLS.book);

export const booksCDSearchSuccess = makeSuccess(URLS.cd, "books_cd_search_success.json");
export const booksDVDSearchSuccess = makeSuccess(URLS.dvd, "books_dvd_search_success.json");
export const booksForeignBookSearchSuccess = makeSuccess(URLS.foreign, "books_foreign_book_search_success.json");
export const booksMagazineSearchSuccess = makeSuccess(URLS.magazine, "books_magazine_search_success.json");
export const booksGameSearchSuccess = makeSuccess(URLS.game, "books_game_search_success.json");
export const booksSoftwareSearchSuccess = makeSuccess(URLS.software, "books_software_search_success.json");

export const booksGenreSearchTop = makeSuccess(URLS.genre, "books_genre_search_top.json");
export const booksGenreSearchNested = makeSuccess(URLS.genre, "books_genre_search_nested.json");
export const booksGenreSearchAuthInvalid = makeAuthInvalid(URLS.genre);
export const booksGenreSearchServerError = makeServerError(URLS.genre);
