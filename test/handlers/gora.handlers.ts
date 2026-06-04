/**
 * msw handlers for GORA (golf) endpoints.
 */

import { http, HttpResponse } from "msw";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "fixtures", "gora");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

const URLS = {
  course:        "https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseSearch/20170623",
  courseDetail:  "https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseDetail/20170623",
  plan:          "https://openapi.rakuten.co.jp/engine/api/Gora/GoraPlanSearch/20170623",
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

export const goraCourseSearchSuccess = makeSuccess(URLS.course, "golf_course_search_success.json");
export const goraCourseSearchAuthInvalid = makeAuthInvalid(URLS.course);
export const goraCourseSearchServerError = makeServerError(URLS.course);

export const goraCourseDetailSuccess = makeSuccess(URLS.courseDetail, "golf_course_detail_success.json");
export const goraCourseDetailAuthInvalid = makeAuthInvalid(URLS.courseDetail);

export const goraPlanSearchSuccess = makeSuccess(URLS.plan, "plan_search_success.json");
export const goraPlanSearchAuthInvalid = makeAuthInvalid(URLS.plan);
