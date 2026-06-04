/**
 * Tests for src/tools/travel.ts.
 *
 * Travel's mapper (flattenHotel) merges an array of typed info blocks per
 * hotel — different code path from Books envelope mapping. Tests focus on
 * the structural surprises: double-wrap flattening, plan extraction, ranking
 * triple-wrap, area-class deep tree, chain list traversal.
 */

import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.js";
import { RakutenBadRequestError, RakutenServerError } from "../src/errors.js";
import {
  travelGetAreaClassTool,
  travelGetHotelChainListTool,
  travelHotelDetailSearchTool,
  travelHotelRankingTool,
  travelKeywordHotelSearchTool,
  travelSimpleHotelSearchTool,
  travelVacantHotelSearchTool,
} from "../src/tools/travel.js";
import {
  travelGetAreaClassSuccess,
  travelGetHotelChainListSuccess,
  travelHotelDetailSearchSuccess,
  travelHotelRankingSuccess,
  travelKeywordHotelSearchSuccess,
  travelSimpleHotelSearchAuthInvalid,
  travelSimpleHotelSearchServerError,
  travelSimpleHotelSearchSuccess,
  travelVacantHotelSearchSuccess,
} from "./handlers/travel.handlers.js";
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
// travel_simple_hotel_search
// ──────────────────────────────────────────────────────────────────────────────

describe("travelSimpleHotelSearch — tool definition", () => {
  it("registers under the expected MCP name", () => {
    expect(travelSimpleHotelSearchTool.name).toBe("travel_simple_hotel_search");
  });
  it("has bilingual title and description", () => {
    expect(travelSimpleHotelSearchTool.title.en).toBeTruthy();
    expect(travelSimpleHotelSearchTool.title.ja).toBeTruthy();
  });
});

describe("travelSimpleHotelSearch — Zod input validation", () => {
  it("requires either largeClassCode or both lat/lon", () => {
    const parse = () => travelSimpleHotelSearchTool.inputSchema.parse({});
    expect(parse).toThrow();
  });
  it("accepts area-code-only", () => {
    const parsed = travelSimpleHotelSearchTool.inputSchema.parse({
      largeClassCode: "japan",
      middleClassCode: "tokyo",
    });
    expect(parsed.largeClassCode).toBe("japan");
  });
  it("accepts lat/lon-only", () => {
    const parsed = travelSimpleHotelSearchTool.inputSchema.parse({
      latitude: 35.6,
      longitude: 139.7,
    });
    expect(parsed.latitude).toBe(35.6);
  });
  it("rejects searchRadius > 3.0", () => {
    const parse = () =>
      travelSimpleHotelSearchTool.inputSchema.parse({
        latitude: 35.6,
        longitude: 139.7,
        searchRadius: 5,
      });
    expect(parse).toThrow();
  });
});

describe("travelSimpleHotelSearch — handler behaviour", () => {
  it("flattens the double-wrap into a Hotel object", async () => {
    server.use(travelSimpleHotelSearchSuccess());
    const result = await travelSimpleHotelSearchTool.handler(
      {
        largeClassCode: "japan",
        middleClassCode: "tokyo",
        smallClassCode: "tokyo",
        detailClassCode: "A",
        hits: 2,
        page: 1,
      },
      testConfig,
    );
    const r = result as {
      recordCount: number;
      hotels: Array<{
        hotelNo: number;
        hotelName: string;
        reviewCount: number;
        ratings?: Record<string, unknown>;
        address1?: string;
      }>;
    };
    expect(r.recordCount).toBeGreaterThan(0);
    expect(r.hotels.length).toBeGreaterThan(0);
    expect(r.hotels[0].hotelNo).toBeGreaterThan(0);
    expect(r.hotels[0].hotelName.length).toBeGreaterThan(0);
    // hotelRatingInfo block should have been merged in
    expect(r.hotels[0].ratings).toBeDefined();
  });

  it("throws RakutenBadRequestError on 400", async () => {
    server.use(travelSimpleHotelSearchAuthInvalid());
    await expect(
      travelSimpleHotelSearchTool.handler(
        { largeClassCode: "japan", hits: 1, page: 1 },
        testConfig,
      ),
    ).rejects.toBeInstanceOf(RakutenBadRequestError);
  });

  it("retries 5xx then throws RakutenServerError", async () => {
    server.use(travelSimpleHotelSearchServerError());
    await expect(
      travelSimpleHotelSearchTool.handler(
        { largeClassCode: "japan", hits: 1, page: 1 },
        testConfig,
      ),
    ).rejects.toBeInstanceOf(RakutenServerError);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// travel_vacant_hotel_search
// ──────────────────────────────────────────────────────────────────────────────

describe("travelVacantHotelSearch", () => {
  it("registers and is bilingual", () => {
    expect(travelVacantHotelSearchTool.name).toBe("travel_vacant_hotel_search");
    expect(travelVacantHotelSearchTool.title.ja).toBeTruthy();
  });

  it("rejects malformed checkinDate", () => {
    const parse = () =>
      travelVacantHotelSearchTool.inputSchema.parse({
        checkinDate: "2026/07/01",
        checkoutDate: "2026-07-02",
        largeClassCode: "japan",
      });
    expect(parse).toThrow();
  });

  it("attaches room plans from roomInfo blocks", async () => {
    server.use(travelVacantHotelSearchSuccess());
    const result = await travelVacantHotelSearchTool.handler(
      {
        checkinDate: "2026-07-01",
        checkoutDate: "2026-07-02",
        adultNum: 1,
        roomNum: 1,
        largeClassCode: "japan",
        middleClassCode: "tokyo",
        smallClassCode: "tokyo",
        detailClassCode: "A",
        hits: 2,
        page: 1,
      },
      testConfig,
    );
    const r = result as {
      hotels: Array<{
        hotelNo: number;
        plans?: Array<{ planName?: string; pricePerNight?: number }>;
      }>;
    };
    expect(r.hotels.length).toBeGreaterThan(0);
    const firstWithPlans = r.hotels.find((h) => h.plans && h.plans.length > 0);
    expect(firstWithPlans, "expected at least one hotel with plans").toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// travel_hotel_detail_search
// ──────────────────────────────────────────────────────────────────────────────

describe("travelHotelDetailSearch", () => {
  it("registers and is bilingual", () => {
    expect(travelHotelDetailSearchTool.name).toBe("travel_hotel_detail_search");
    expect(travelHotelDetailSearchTool.title.ja).toBeTruthy();
  });

  it("requires a positive hotelNo", () => {
    const parse = () => travelHotelDetailSearchTool.inputSchema.parse({ hotelNo: -1 });
    expect(parse).toThrow();
  });

  it("returns a single flattened Hotel", async () => {
    server.use(travelHotelDetailSearchSuccess());
    const result = await travelHotelDetailSearchTool.handler({ hotelNo: 1217 }, testConfig);
    const r = result as {
      hotelNo: number;
      hotelName: string;
      reviewCount: number;
      ratings?: Record<string, unknown>;
    };
    expect(r.hotelNo).toBeGreaterThan(0);
    expect(r.hotelName.length).toBeGreaterThan(0);
    expect(r.ratings).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// travel_get_area_class
// ──────────────────────────────────────────────────────────────────────────────

describe("travelGetAreaClass", () => {
  it("registers and is bilingual", () => {
    expect(travelGetAreaClassTool.name).toBe("travel_get_area_class");
    expect(travelGetAreaClassTool.title.ja).toBeTruthy();
  });

  it("normalizes the deeply nested area tree into a flat-ish structure", async () => {
    server.use(travelGetAreaClassSuccess());
    const result = await travelGetAreaClassTool.handler({}, testConfig);
    const r = result as {
      larges: Array<{
        code: string;
        name: string;
        middles?: Array<{
          code: string;
          name: string;
          smalls?: Array<{ code: string; name: string }>;
        }>;
      }>;
    };
    expect(r.larges.length).toBeGreaterThan(0);
    const japan = r.larges.find((l) => l.code === "japan");
    expect(japan, "expected 'japan' in larges").toBeDefined();
    expect(japan?.middles?.length ?? 0).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// travel_keyword_hotel_search
// ──────────────────────────────────────────────────────────────────────────────

describe("travelKeywordHotelSearch", () => {
  it("registers and is bilingual", () => {
    expect(travelKeywordHotelSearchTool.name).toBe("travel_keyword_hotel_search");
    expect(travelKeywordHotelSearchTool.title.ja).toBeTruthy();
  });

  it("requires keyword min length 2", () => {
    const parse = () => travelKeywordHotelSearchTool.inputSchema.parse({ keyword: "x" });
    expect(parse).toThrow();
  });

  it("returns paged hotels for a keyword", async () => {
    server.use(travelKeywordHotelSearchSuccess());
    const result = await travelKeywordHotelSearchTool.handler(
      { keyword: "Shibuya", hits: 2, page: 1 },
      testConfig,
    );
    const r = result as { hotels: Array<{ hotelName: string }> };
    expect(r.hotels.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// travel_get_hotel_chain_list
// ──────────────────────────────────────────────────────────────────────────────

describe("travelGetHotelChainList", () => {
  it("registers and is bilingual", () => {
    expect(travelGetHotelChainListTool.name).toBe("travel_get_hotel_chain_list");
    expect(travelGetHotelChainListTool.title.ja).toBeTruthy();
  });

  it("flattens nested chain blocks into a single chains array", async () => {
    server.use(travelGetHotelChainListSuccess());
    const result = await travelGetHotelChainListTool.handler({}, testConfig);
    const r = result as { chains: Array<{ code: string; name: string }> };
    expect(r.chains.length).toBeGreaterThan(0);
    expect(r.chains[0].code.length).toBeGreaterThan(0);
    expect(r.chains[0].name.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// travel_hotel_ranking
// ──────────────────────────────────────────────────────────────────────────────

describe("travelHotelRanking", () => {
  it("registers and is bilingual", () => {
    expect(travelHotelRankingTool.name).toBe("travel_hotel_ranking");
    expect(travelHotelRankingTool.title.ja).toBeTruthy();
  });

  it("defaults genre to 'all'", () => {
    const parsed = travelHotelRankingTool.inputSchema.parse({});
    expect(parsed.genre).toBe("all");
  });

  it("rejects an unknown genre", () => {
    const parse = () =>
      travelHotelRankingTool.inputSchema.parse({ genre: "not-a-genre" });
    expect(parse).toThrow();
  });

  it("returns ranked hotels with rank field", async () => {
    server.use(travelHotelRankingSuccess());
    const result = await travelHotelRankingTool.handler({ genre: "all" }, testConfig);
    const r = result as {
      title: string;
      genre: string;
      hotels: Array<{ rank: number; hotelName: string }>;
    };
    expect(r.genre).toBe("all");
    expect(r.hotels.length).toBeGreaterThan(0);
    expect(r.hotels[0].rank).toBe(1);
    expect(r.hotels[r.hotels.length - 1].rank).toBeGreaterThanOrEqual(r.hotels.length);
  });
});
