/**
 * Tests for src/tools/kobo.ts.
 */

import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.js";
import { RakutenBadRequestError, RakutenServerError } from "../src/errors.js";
import { koboEbookSearchTool, koboGenreSearchTool } from "../src/tools/kobo.js";
import {
  koboEbookSearchAuthInvalid,
  koboEbookSearchEmpty,
  koboEbookSearchServerError,
  koboEbookSearchSuccess,
  koboGenreSearchAuthInvalid,
  koboGenreSearchNested,
  koboGenreSearchTop,
} from "./handlers/kobo.handlers.js";
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

describe("koboEbookSearch — tool definition", () => {
  it("registers and is bilingual", () => {
    expect(koboEbookSearchTool.name).toBe("kobo_ebook_search");
    expect(koboEbookSearchTool.title.ja).toBeTruthy();
  });
  it("requires at least one search field", () => {
    const parse = () =>
      koboEbookSearchTool.inputSchema.parse({ hits: 1, page: 1, sort: "standard" });
    expect(parse).toThrow();
  });
  it("applies sort/page/hits defaults", () => {
    const parsed = koboEbookSearchTool.inputSchema.parse({ keyword: "x" });
    expect(parsed.hits).toBe(10);
    expect(parsed.page).toBe(1);
    expect(parsed.sort).toBe("standard");
  });
});

describe("koboEbookSearch — handler behaviour", () => {
  it("maps ebook items with language and koboGenreId fields", async () => {
    server.use(koboEbookSearchSuccess());
    const result = await koboEbookSearchTool.handler(
      { keyword: "村上春樹", hits: 2, page: 1, sort: "standard" },
      testConfig,
    );
    const r = result as {
      count: number;
      items: Array<{ title: string; language?: string; koboGenreId?: string }>;
    };
    expect(r.count).toBeGreaterThan(0);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0].title.length).toBeGreaterThan(0);
    // language should be ISO-style code
    expect(r.items[0].language).toBeTruthy();
  });

  it("returns empty items when no results", async () => {
    server.use(koboEbookSearchEmpty());
    const result = await koboEbookSearchTool.handler(
      { keyword: "zzz", hits: 1, page: 1, sort: "standard" },
      testConfig,
    );
    const r = result as { items: unknown[] };
    expect(r.items).toEqual([]);
  });

  it("throws RakutenBadRequestError on 400", async () => {
    server.use(koboEbookSearchAuthInvalid());
    await expect(
      koboEbookSearchTool.handler(
        { keyword: "x", hits: 1, page: 1, sort: "standard" },
        testConfig,
      ),
    ).rejects.toBeInstanceOf(RakutenBadRequestError);
  });

  it("retries 5xx then throws RakutenServerError", async () => {
    server.use(koboEbookSearchServerError());
    await expect(
      koboEbookSearchTool.handler(
        { keyword: "x", hits: 1, page: 1, sort: "standard" },
        testConfig,
      ),
    ).rejects.toBeInstanceOf(RakutenServerError);
  });
});

describe("koboGenreSearch", () => {
  it("registers and is bilingual", () => {
    expect(koboGenreSearchTool.name).toBe("kobo_genre_search");
    expect(koboGenreSearchTool.title.ja).toBeTruthy();
  });
  it("defaults koboGenreId to '101' (eBooks top)", () => {
    const parsed = koboGenreSearchTool.inputSchema.parse({});
    expect(parsed.koboGenreId).toBe("101");
  });
  it("returns current + children on top-level", async () => {
    server.use(koboGenreSearchTop());
    const result = await koboGenreSearchTool.handler({ koboGenreId: "101" }, testConfig);
    const r = result as {
      current: { koboGenreId: string; koboGenreName: string };
      parents: unknown[];
      children: Array<{ koboGenreId: string; koboGenreName: string }>;
    };
    expect(r.current.koboGenreId).toBe("101");
    expect(r.current.koboGenreName.length).toBeGreaterThan(0);
    expect(r.children.length).toBeGreaterThan(0);
  });
  it("returns parents on a nested genre", async () => {
    server.use(koboGenreSearchNested());
    const result = await koboGenreSearchTool.handler({ koboGenreId: "101901" }, testConfig);
    const r = result as { parents: unknown[]; current: { koboGenreId: string } };
    expect(r.current.koboGenreId).toBe("101901");
    expect(r.parents.length).toBeGreaterThan(0);
  });
  it("throws RakutenBadRequestError on 400", async () => {
    server.use(koboGenreSearchAuthInvalid());
    await expect(
      koboGenreSearchTool.handler({ koboGenreId: "101" }, testConfig),
    ).rejects.toBeInstanceOf(RakutenBadRequestError);
  });
});
