/**
 * msw handlers for Kobo endpoints.
 */

import { http, HttpResponse } from "msw";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "fixtures", "kobo");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

const URLS = {
  ebook: "https://openapi.rakuten.co.jp/services/api/Kobo/EbookSearch/20170426",
  genre: "https://openapi.rakuten.co.jp/services/api/Kobo/GenreSearch/20131010",
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

export const koboEbookSearchSuccess = makeSuccess(URLS.ebook, "ebook_search_success.json");
export const koboEbookSearchEmpty = makeSuccess(URLS.ebook, "ebook_search_empty.json");
export const koboEbookSearchAuthInvalid = makeAuthInvalid(URLS.ebook);
export const koboEbookSearchServerError = makeServerError(URLS.ebook);

export const koboGenreSearchTop = makeSuccess(URLS.genre, "genre_search_top.json");
export const koboGenreSearchNested = makeSuccess(URLS.genre, "genre_search_nested.json");
export const koboGenreSearchAuthInvalid = makeAuthInvalid(URLS.genre);
