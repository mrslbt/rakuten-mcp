/**
 * msw handlers for Travel endpoints.
 */

import { http, HttpResponse } from "msw";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "fixtures", "travel");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

const URLS = {
  simple:    "https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20170426",
  vacant:    "https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426",
  detail:    "https://openapi.rakuten.co.jp/engine/api/Travel/HotelDetailSearch/20170426",
  area:      "https://openapi.rakuten.co.jp/engine/api/Travel/GetAreaClass/20140210",
  keyword:   "https://openapi.rakuten.co.jp/engine/api/Travel/KeywordHotelSearch/20170426",
  chains:    "https://openapi.rakuten.co.jp/engine/api/Travel/GetHotelChainList/20131024",
  ranking:   "https://openapi.rakuten.co.jp/engine/api/Travel/HotelRanking/20170426",
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

export const travelSimpleHotelSearchSuccess = makeSuccess(URLS.simple, "simple_hotel_search_success.json");
export const travelSimpleHotelSearchAuthInvalid = makeAuthInvalid(URLS.simple);
export const travelSimpleHotelSearchServerError = makeServerError(URLS.simple);

export const travelVacantHotelSearchSuccess = makeSuccess(URLS.vacant, "vacant_hotel_search_success.json");
export const travelHotelDetailSearchSuccess = makeSuccess(URLS.detail, "hotel_detail_search_success.json");
export const travelGetAreaClassSuccess = makeSuccess(URLS.area, "get_area_class_success.json");
export const travelKeywordHotelSearchSuccess = makeSuccess(URLS.keyword, "keyword_hotel_search_success.json");
export const travelGetHotelChainListSuccess = makeSuccess(URLS.chains, "get_hotel_chain_list_success.json");
export const travelHotelRankingSuccess = makeSuccess(URLS.ranking, "hotel_ranking_success.json");
