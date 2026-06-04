/**
 * msw handlers for Recipe endpoints.
 */

import { http, HttpResponse } from "msw";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "fixtures", "recipe");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

const URLS = {
  list:    "https://openapi.rakuten.co.jp/recipems/api/Recipe/CategoryList/20170426",
  ranking: "https://openapi.rakuten.co.jp/recipems/api/Recipe/CategoryRanking/20170426",
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

export const recipeCategoryListSuccess = makeSuccess(URLS.list, "category_list_success.json");
export const recipeCategoryListAuthInvalid = makeAuthInvalid(URLS.list);
export const recipeCategoryListServerError = makeServerError(URLS.list);

export const recipeCategoryRankingSuccess = makeSuccess(URLS.ranking, "category_ranking_success.json");
export const recipeCategoryRankingAuthInvalid = makeAuthInvalid(URLS.ranking);
