/**
 * Tests for src/tools/gora.ts.
 */

import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.js";
import { RakutenBadRequestError, RakutenServerError } from "../src/errors.js";
import {
  goraGolfCourseDetailTool,
  goraGolfCourseSearchTool,
  goraPlanSearchTool,
} from "../src/tools/gora.js";
import {
  goraCourseDetailAuthInvalid,
  goraCourseDetailSuccess,
  goraCourseSearchAuthInvalid,
  goraCourseSearchServerError,
  goraCourseSearchSuccess,
  goraPlanSearchAuthInvalid,
  goraPlanSearchSuccess,
} from "./handlers/gora.handlers.js";
import { server } from "./msw-server.js";

const testConfig: Config = {
  applicationId: "test-app-id",
  accessKey: "test-access-key",
  affiliateId: undefined,
  hostOverride: undefined,
  transport: "stdio",
  httpPort: 3000,
  httpHost: "127.0.0.1",
  httpAuthToken: undefined,
  httpAllowedOrigins: [],
  maxRetries: 2,
};

// ──────────────────────────────────────────────────────────────────────────────
// gora_golf_course_search
// ──────────────────────────────────────────────────────────────────────────────

describe("goraGolfCourseSearch — tool definition", () => {
  it("registers and is bilingual", () => {
    expect(goraGolfCourseSearchTool.name).toBe("gora_golf_course_search");
    expect(goraGolfCourseSearchTool.title.ja).toBeTruthy();
  });
});

describe("goraGolfCourseSearch — Zod validation", () => {
  it("rejects all-empty input", () => {
    const parse = () => goraGolfCourseSearchTool.inputSchema.parse({});
    expect(parse).toThrow();
  });
  it("accepts areaCode-only", () => {
    const parsed = goraGolfCourseSearchTool.inputSchema.parse({ areaCode: "13" });
    expect(parsed.areaCode).toBe("13");
  });
  it("rejects searchRange > 80", () => {
    const parse = () =>
      goraGolfCourseSearchTool.inputSchema.parse({
        latitude: 35,
        longitude: 139,
        searchRange: 100,
      });
    expect(parse).toThrow();
  });
});

describe("goraGolfCourseSearch — handler behaviour", () => {
  it("maps course summaries with id, name, address, evaluation", async () => {
    server.use(goraCourseSearchSuccess());
    const result = await goraGolfCourseSearchTool.handler(
      { areaCode: "13", hits: 2, page: 1 },
      testConfig,
    );
    const r = result as {
      count: number;
      courses: Array<{
        golfCourseId: number;
        golfCourseName: string;
        evaluation?: number | string;
        reserveCalUrl?: string;
      }>;
    };
    expect(r.count).toBeGreaterThan(0);
    expect(r.courses.length).toBeGreaterThan(0);
    expect(r.courses[0].golfCourseId).toBeGreaterThan(0);
    expect(r.courses[0].golfCourseName.length).toBeGreaterThan(0);
  });

  it("throws RakutenBadRequestError on 400", async () => {
    server.use(goraCourseSearchAuthInvalid());
    await expect(
      goraGolfCourseSearchTool.handler(
        { areaCode: "13", hits: 1, page: 1 },
        testConfig,
      ),
    ).rejects.toBeInstanceOf(RakutenBadRequestError);
  });

  it("retries 5xx then throws RakutenServerError", async () => {
    server.use(goraCourseSearchServerError());
    await expect(
      goraGolfCourseSearchTool.handler(
        { areaCode: "13", hits: 1, page: 1 },
        testConfig,
      ),
    ).rejects.toBeInstanceOf(RakutenServerError);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// gora_golf_course_detail
// ──────────────────────────────────────────────────────────────────────────────

describe("goraGolfCourseDetail", () => {
  it("registers and is bilingual", () => {
    expect(goraGolfCourseDetailTool.name).toBe("gora_golf_course_detail");
    expect(goraGolfCourseDetailTool.title.ja).toBeTruthy();
  });

  it("requires a positive golfCourseId", () => {
    const parse = () =>
      goraGolfCourseDetailTool.inputSchema.parse({ golfCourseId: 0 });
    expect(parse).toThrow();
  });

  it("merges all 5 image slots into one array and exposes detail fields", async () => {
    server.use(goraCourseDetailSuccess());
    const result = await goraGolfCourseDetailTool.handler(
      { golfCourseId: 10005 },
      testConfig,
    );
    const r = result as {
      golfCourseId: number;
      golfCourseName: string;
      imageUrls: string[];
      designer?: string;
      holeCount?: number;
      parCount?: number;
      baseHolidayMinPrice?: number;
    };
    expect(r.golfCourseId).toBe(10005);
    expect(r.golfCourseName.length).toBeGreaterThan(0);
    expect(Array.isArray(r.imageUrls)).toBe(true);
    expect(typeof r.holeCount).toBe("number");
  });

  it("throws RakutenBadRequestError on 400", async () => {
    server.use(goraCourseDetailAuthInvalid());
    await expect(
      goraGolfCourseDetailTool.handler({ golfCourseId: 10005 }, testConfig),
    ).rejects.toBeInstanceOf(RakutenBadRequestError);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// gora_plan_search
// ──────────────────────────────────────────────────────────────────────────────

describe("goraPlanSearch", () => {
  it("registers and is bilingual", () => {
    expect(goraPlanSearchTool.name).toBe("gora_plan_search");
    expect(goraPlanSearchTool.title.ja).toBeTruthy();
  });

  it("requires areaCode or golfCourseId", () => {
    const parse = () =>
      goraPlanSearchTool.inputSchema.parse({
        playDate: "2026-07-01",
        hits: 1,
        page: 1,
      });
    expect(parse).toThrow();
  });

  it("rejects malformed playDate", () => {
    const parse = () =>
      goraPlanSearchTool.inputSchema.parse({
        areaCode: "13",
        playDate: "2026/07/01",
        hits: 1,
        page: 1,
      });
    expect(parse).toThrow();
  });

  it("flattens planInfo into plans[] under each course", async () => {
    server.use(goraPlanSearchSuccess());
    const result = await goraPlanSearchTool.handler(
      { areaCode: "13", playDate: "2026-07-01", hits: 2, page: 1 },
      testConfig,
    );
    const r = result as {
      count: number;
      courses: Array<{
        golfCourseId: number;
        plans: Array<{ planId?: string; planName?: string; basePrice?: number }>;
      }>;
    };
    expect(r.courses.length).toBeGreaterThan(0);
    const courseWithPlans = r.courses.find((c) => c.plans.length > 0);
    expect(courseWithPlans, "expected at least one course with plans").toBeDefined();
    expect(courseWithPlans?.plans[0].planName?.length ?? 0).toBeGreaterThan(0);
  });

  it("throws RakutenBadRequestError on 400", async () => {
    server.use(goraPlanSearchAuthInvalid());
    await expect(
      goraPlanSearchTool.handler(
        { areaCode: "13", playDate: "2026-07-01", hits: 1, page: 1 },
        testConfig,
      ),
    ).rejects.toBeInstanceOf(RakutenBadRequestError);
  });
});
