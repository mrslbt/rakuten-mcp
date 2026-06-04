/**
 * Tests for src/tools/ichiba.ts — the canonical template.
 *
 * Every Rakuten tool's tests follow this 6-scenario pattern:
 *   1. success
 *   2. no-results
 *   3. Zod validation (missing required param)
 *   4. auth error (400 wrong_parameter from legacy host)
 *   5. rate-limit retry (429 N times → 200)
 *   6. server error (500, retried to exhaustion)
 */

import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.js";
import { HOST_LEGACY } from "../src/config.js";
import {
  RakutenBadRequestError,
  RakutenServerError,
} from "../src/errors.js";
import { ichibaItemSearchTool } from "../src/tools/ichiba.js";
import {
  itemSearchAuthInvalid,
  itemSearchEmpty,
  itemSearchRateLimitedThenSuccess,
  itemSearchServerError,
  itemSearchSuccess,
} from "./handlers/ichiba.handlers.js";
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
  // Tight retry budget so tests stay fast — backoff is 500ms, 1s, 2s, 4s.
  // With maxRetries=2 the longest possible test takes ~1.5s for a 5xx exhaustion.
  maxRetries: 2,
};

describe("ichibaItemSearch — tool definition", () => {
  it("registers under the expected MCP name", () => {
    expect(ichibaItemSearchTool.name).toBe("ichiba_item_search");
  });

  it("has bilingual title and description", () => {
    expect(ichibaItemSearchTool.title.en).toBeTruthy();
    expect(ichibaItemSearchTool.title.ja).toBeTruthy();
    expect(ichibaItemSearchTool.description.en.length).toBeGreaterThan(20);
    expect(ichibaItemSearchTool.description.ja.length).toBeGreaterThan(10);
  });

  it("uses the legacy host (Ichiba is not yet migrated)", () => {
    // Sanity: confirm the constant we import equals what tools target.
    expect(HOST_LEGACY).toBe("https://app.rakuten.co.jp");
  });
});

describe("ichibaItemSearch — Zod input validation", () => {
  it("rejects missing required keyword", () => {
    const parse = () =>
      ichibaItemSearchTool.inputSchema.parse({} as unknown);
    expect(parse).toThrow();
  });

  it("rejects empty keyword string", () => {
    const parse = () =>
      ichibaItemSearchTool.inputSchema.parse({ keyword: "" });
    expect(parse).toThrow();
  });

  it("rejects hits > 30", () => {
    const parse = () =>
      ichibaItemSearchTool.inputSchema.parse({ keyword: "test", hits: 31 });
    expect(parse).toThrow();
  });

  it("rejects negative price", () => {
    const parse = () =>
      ichibaItemSearchTool.inputSchema.parse({ keyword: "test", min_price: -1 });
    expect(parse).toThrow();
  });

  it("accepts valid input with defaults", () => {
    const parsed = ichibaItemSearchTool.inputSchema.parse({ keyword: "イヤホン" });
    expect(parsed.keyword).toBe("イヤホン");
    expect(parsed.hits).toBe(10);
    expect(parsed.page).toBe(1);
    expect(parsed.sort).toBe("standard");
  });
});

describe("ichibaItemSearch — handler behaviour", () => {
  it("returns mapped items on success", async () => {
    server.use(itemSearchSuccess());

    const result = await ichibaItemSearchTool.handler(
      { keyword: "イヤホン", hits: 3, page: 1, sort: "standard" },
      testConfig,
    );

    // Generic type widens to unknown at runtime; narrow for the assertions.
    const r = result as {
      count: number;
      page: number;
      items: Array<{
        itemName: string;
        itemPrice: number;
        itemUrl: string;
        shopName: string;
        reviewCount: number;
        reviewAverage: number | string;
        imageUrl?: string;
      }>;
    };

    expect(r.count).toBe(5283);
    expect(r.page).toBe(1);
    expect(r.items).toHaveLength(3);
    expect(r.items[0].itemName).toContain("ワイヤレスイヤホン");
    expect(r.items[0].itemPrice).toBe(4980);
    expect(r.items[0].shopName).toBe("イヤホン専門店");
    expect(r.items[0].reviewCount).toBe(1842);
    expect(r.items[0].imageUrl).toContain("thumbnail.image.rakuten.co.jp");
    expect(r.items[2].itemPrice).toBe(12800);
  });

  it("returns empty items array when Rakuten returns no matches", async () => {
    server.use(itemSearchEmpty());

    const result = await ichibaItemSearchTool.handler(
      { keyword: "this-keyword-matches-nothing-zzzzz", hits: 10, page: 1, sort: "standard" },
      testConfig,
    );

    const r = result as { count: number; items: unknown[] };
    expect(r.count).toBe(0);
    expect(r.items).toEqual([]);
  });

  it("throws RakutenBadRequestError on 400 from Rakuten (legacy-host shape)", async () => {
    server.use(itemSearchAuthInvalid());

    await expect(
      ichibaItemSearchTool.handler(
        { keyword: "test", hits: 10, page: 1, sort: "standard" },
        testConfig,
      ),
    ).rejects.toBeInstanceOf(RakutenBadRequestError);
  });

  it("retries 429 then succeeds (rate-limit recovery)", async () => {
    server.use(itemSearchRateLimitedThenSuccess(1));

    const result = await ichibaItemSearchTool.handler(
      { keyword: "test", hits: 10, page: 1, sort: "standard" },
      testConfig,
    );

    const r = result as { count: number };
    expect(r.count).toBe(5283);
  });

  it("retries 5xx and eventually throws RakutenServerError after exhaustion", async () => {
    server.use(itemSearchServerError());

    await expect(
      ichibaItemSearchTool.handler(
        { keyword: "test", hits: 10, page: 1, sort: "standard" },
        testConfig,
      ),
    ).rejects.toBeInstanceOf(RakutenServerError);
  });
});
