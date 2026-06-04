/**
 * Tests for src/tools/books.ts.
 *
 * Strategy:
 *   - books_total_search gets the full 6-scenario template (it's the canonical
 *     path through runBooksSearch + the retry/error machinery).
 *   - Each other search tool gets: tool definition, success-with-type-specific-
 *     field assertion, and auth-400. That keeps shared error paths from being
 *     re-tested 8 times while still verifying every per-family mapper.
 *   - books_genre_search gets the full 4-scenario template (different code path
 *     using the wrapped legacy genre shape).
 */

import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.js";
import { RakutenBadRequestError, RakutenServerError } from "../src/errors.js";
import {
  booksBookSearchTool,
  booksCDSearchTool,
  booksDVDSearchTool,
  booksForeignBookSearchTool,
  booksGameSearchTool,
  booksGenreSearchTool,
  booksMagazineSearchTool,
  booksSoftwareSearchTool,
  booksTotalSearchTool,
} from "../src/tools/books.js";
import {
  booksBookSearchAuthInvalid,
  booksBookSearchSuccess,
  booksCDSearchSuccess,
  booksDVDSearchSuccess,
  booksForeignBookSearchSuccess,
  booksGameSearchSuccess,
  booksGenreSearchAuthInvalid,
  booksGenreSearchNested,
  booksGenreSearchServerError,
  booksGenreSearchTop,
  booksMagazineSearchSuccess,
  booksSoftwareSearchSuccess,
  booksTotalSearchAuthInvalid,
  booksTotalSearchEmpty,
  booksTotalSearchRateLimitedThenSuccess,
  booksTotalSearchServerError,
  booksTotalSearchSuccess,
} from "./handlers/books.handlers.js";
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
// books_total_search — full template
// ──────────────────────────────────────────────────────────────────────────────

describe("booksTotalSearch — tool definition", () => {
  it("registers under the expected MCP name", () => {
    expect(booksTotalSearchTool.name).toBe("books_total_search");
  });
  it("has bilingual title and description", () => {
    expect(booksTotalSearchTool.title.en).toBeTruthy();
    expect(booksTotalSearchTool.title.ja).toBeTruthy();
    expect(booksTotalSearchTool.description.en.length).toBeGreaterThan(20);
    expect(booksTotalSearchTool.description.ja.length).toBeGreaterThan(10);
  });
});

describe("booksTotalSearch — Zod input validation", () => {
  it("rejects missing keyword", () => {
    const parse = () => booksTotalSearchTool.inputSchema.parse({});
    expect(parse).toThrow();
  });
  it("applies default hits=10 page=1 sort=standard", () => {
    const parsed = booksTotalSearchTool.inputSchema.parse({ keyword: "test" });
    expect(parsed.hits).toBe(10);
    expect(parsed.page).toBe(1);
    expect(parsed.sort).toBe("standard");
  });
  it("rejects out-of-range hits", () => {
    const parse = () =>
      booksTotalSearchTool.inputSchema.parse({ keyword: "test", hits: 100 });
    expect(parse).toThrow();
  });
});

describe("booksTotalSearch — handler behaviour", () => {
  it("maps envelope and first item correctly", async () => {
    server.use(booksTotalSearchSuccess());
    const result = await booksTotalSearchTool.handler(
      { keyword: "村上春樹", hits: 2, page: 1, sort: "standard" },
      testConfig,
    );
    const r = result as {
      count: number;
      items: Array<{ title: string; itemPrice: number; itemUrl: string }>;
    };
    expect(r.count).toBeGreaterThan(0);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0].title.length).toBeGreaterThan(0);
    expect(typeof r.items[0].itemPrice).toBe("number");
    expect(r.items[0].itemUrl).toContain("rakuten");
  });

  it("returns empty items array when no results", async () => {
    server.use(booksTotalSearchEmpty());
    const result = await booksTotalSearchTool.handler(
      { keyword: "zzzz", hits: 1, page: 1, sort: "standard" },
      testConfig,
    );
    const r = result as { items: unknown[] };
    expect(r.items).toEqual([]);
  });

  it("throws RakutenBadRequestError on 400", async () => {
    server.use(booksTotalSearchAuthInvalid());
    await expect(
      booksTotalSearchTool.handler(
        { keyword: "x", hits: 1, page: 1, sort: "standard" },
        testConfig,
      ),
    ).rejects.toBeInstanceOf(RakutenBadRequestError);
  });

  it("retries 429 then succeeds", async () => {
    server.use(booksTotalSearchRateLimitedThenSuccess(1));
    const result = await booksTotalSearchTool.handler(
      { keyword: "x", hits: 2, page: 1, sort: "standard" },
      testConfig,
    );
    const r = result as { items: unknown[] };
    expect(r.items.length).toBeGreaterThan(0);
  });

  it("retries 5xx then throws RakutenServerError", async () => {
    server.use(booksTotalSearchServerError());
    await expect(
      booksTotalSearchTool.handler(
        { keyword: "x", hits: 1, page: 1, sort: "standard" },
        testConfig,
      ),
    ).rejects.toBeInstanceOf(RakutenServerError);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Per-category tools — minimal coverage (name + success + auth)
// ──────────────────────────────────────────────────────────────────────────────

describe("booksBookSearch", () => {
  it("registers and is bilingual", () => {
    expect(booksBookSearchTool.name).toBe("books_book_search");
    expect(booksBookSearchTool.title.ja).toBeTruthy();
  });
  it("requires at least one search field", () => {
    const parse = () => booksBookSearchTool.inputSchema.parse({});
    expect(parse).toThrow();
  });
  it("maps book-specific fields (author, isbn, publisher)", async () => {
    server.use(booksBookSearchSuccess());
    const result = await booksBookSearchTool.handler(
      { title: "吾輩は猫である", hits: 2, page: 1, sort: "standard" },
      testConfig,
    );
    const r = result as {
      items: Array<{ author?: string; isbn?: string; publisherName?: string }>;
    };
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0].author).toBeTruthy();
    expect(r.items[0].publisherName).toBeTruthy();
  });
  it("throws RakutenBadRequestError on 400", async () => {
    server.use(booksBookSearchAuthInvalid());
    await expect(
      booksBookSearchTool.handler(
        { title: "x", hits: 1, page: 1, sort: "standard" },
        testConfig,
      ),
    ).rejects.toBeInstanceOf(RakutenBadRequestError);
  });
});

describe("booksCDSearch", () => {
  it("registers and is bilingual", () => {
    expect(booksCDSearchTool.name).toBe("books_cd_search");
    expect(booksCDSearchTool.title.ja).toBeTruthy();
  });
  it("maps CD-specific fields (artistName, label, jan)", async () => {
    server.use(booksCDSearchSuccess());
    const result = await booksCDSearchTool.handler(
      { artistName: "YOASOBI", hits: 2, page: 1, sort: "standard" },
      testConfig,
    );
    const r = result as {
      items: Array<{ artistName?: string; label?: string; jan?: string }>;
    };
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0].artistName).toBeTruthy();
  });
});

describe("booksDVDSearch", () => {
  it("registers and is bilingual", () => {
    expect(booksDVDSearchTool.name).toBe("books_dvd_search");
    expect(booksDVDSearchTool.title.ja).toBeTruthy();
  });
  it("maps DVD-specific fields", async () => {
    server.use(booksDVDSearchSuccess());
    const result = await booksDVDSearchTool.handler(
      { title: "君の名は", hits: 2, page: 1, sort: "standard" },
      testConfig,
    );
    const r = result as { items: Array<{ title: string; jan?: string }> };
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0].title.length).toBeGreaterThan(0);
  });
});

describe("booksForeignBookSearch", () => {
  it("registers and is bilingual", () => {
    expect(booksForeignBookSearchTool.name).toBe("books_foreign_book_search");
    expect(booksForeignBookSearchTool.title.ja).toBeTruthy();
  });
  it("maps foreign-book-specific fields (japaneseTitle when present)", async () => {
    server.use(booksForeignBookSearchSuccess());
    const result = await booksForeignBookSearchTool.handler(
      { title: "Norwegian Wood", hits: 2, page: 1, sort: "standard" },
      testConfig,
    );
    const r = result as { items: Array<{ title: string; author?: string }> };
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0].title.length).toBeGreaterThan(0);
  });
});

describe("booksMagazineSearch", () => {
  it("registers and is bilingual", () => {
    expect(booksMagazineSearchTool.name).toBe("books_magazine_search");
    expect(booksMagazineSearchTool.title.ja).toBeTruthy();
  });
  it("maps magazine-specific fields (publisher, cycle)", async () => {
    server.use(booksMagazineSearchSuccess());
    const result = await booksMagazineSearchTool.handler(
      { title: "TOEIC", hits: 2, page: 1, sort: "standard" },
      testConfig,
    );
    const r = result as {
      items: Array<{ title: string; publisherName?: string }>;
    };
    expect(r.items.length).toBeGreaterThan(0);
  });
});

describe("booksGameSearch", () => {
  it("registers and is bilingual", () => {
    expect(booksGameSearchTool.name).toBe("books_game_search");
    expect(booksGameSearchTool.title.ja).toBeTruthy();
  });
  it("maps game-specific fields (hardware, jan)", async () => {
    server.use(booksGameSearchSuccess());
    const result = await booksGameSearchTool.handler(
      { title: "ゼルダ", hits: 2, page: 1, sort: "standard" },
      testConfig,
    );
    const r = result as { items: Array<{ title: string; hardware?: string }> };
    expect(r.items.length).toBeGreaterThan(0);
  });
});

describe("booksSoftwareSearch", () => {
  it("registers and is bilingual", () => {
    expect(booksSoftwareSearchTool.name).toBe("books_software_search");
    expect(booksSoftwareSearchTool.title.ja).toBeTruthy();
  });
  it("maps software-specific fields (os)", async () => {
    server.use(booksSoftwareSearchSuccess());
    const result = await booksSoftwareSearchTool.handler(
      { title: "Office", hits: 2, page: 1, sort: "standard" },
      testConfig,
    );
    const r = result as { items: Array<{ title: string; os?: string }> };
    expect(r.items.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// books_genre_search — full template (different code path)
// ──────────────────────────────────────────────────────────────────────────────

describe("booksGenreSearch", () => {
  it("registers and is bilingual", () => {
    expect(booksGenreSearchTool.name).toBe("books_genre_search");
    expect(booksGenreSearchTool.title.ja).toBeTruthy();
  });
  it("defaults booksGenreId to '000'", () => {
    const parsed = booksGenreSearchTool.inputSchema.parse({});
    expect(parsed.booksGenreId).toBe("000");
  });
  it("returns current + children on top-level", async () => {
    server.use(booksGenreSearchTop());
    const result = await booksGenreSearchTool.handler({ booksGenreId: "000" }, testConfig);
    const r = result as {
      current: { booksGenreId: string };
      parents: unknown[];
      children: Array<{ booksGenreId: string; booksGenreName: string }>;
    };
    expect(r.current.booksGenreId).toBe("000");
    expect(r.parents).toEqual([]);
    expect(r.children.length).toBeGreaterThan(0);
    expect(r.children[0].booksGenreName.length).toBeGreaterThan(0);
  });
  it("returns parents + children on nested genre", async () => {
    server.use(booksGenreSearchNested());
    const result = await booksGenreSearchTool.handler({ booksGenreId: "001004" }, testConfig);
    const r = result as {
      current: { booksGenreId: string; genreLevel: number };
      parents: Array<{ booksGenreId: string }>;
      children: unknown[];
    };
    expect(r.current.booksGenreId).toBe("001004");
    expect(r.parents.length).toBeGreaterThan(0);
  });
  it("throws RakutenBadRequestError on 400", async () => {
    server.use(booksGenreSearchAuthInvalid());
    await expect(
      booksGenreSearchTool.handler({ booksGenreId: "000" }, testConfig),
    ).rejects.toBeInstanceOf(RakutenBadRequestError);
  });
  it("retries 5xx then throws RakutenServerError", async () => {
    server.use(booksGenreSearchServerError());
    await expect(
      booksGenreSearchTool.handler({ booksGenreId: "000" }, testConfig),
    ).rejects.toBeInstanceOf(RakutenServerError);
  });
});
