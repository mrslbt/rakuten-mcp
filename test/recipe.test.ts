/**
 * Tests for src/tools/recipe.ts.
 *
 * Recipe wraps responses under a `result` key instead of the `Items` envelope
 * used elsewhere. CategoryList's `result` is an object with large/medium/small
 * arrays; CategoryRanking's `result` is a flat array of recipes.
 */

import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.js";
import { RakutenBadRequestError, RakutenServerError } from "../src/errors.js";
import {
  recipeCategoryListTool,
  recipeCategoryRankingTool,
} from "../src/tools/recipe.js";
import {
  recipeCategoryListAuthInvalid,
  recipeCategoryListServerError,
  recipeCategoryListSuccess,
  recipeCategoryRankingAuthInvalid,
  recipeCategoryRankingSuccess,
} from "./handlers/recipe.handlers.js";
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

describe("recipeCategoryList — tool definition", () => {
  it("registers and is bilingual", () => {
    expect(recipeCategoryListTool.name).toBe("recipe_category_list");
    expect(recipeCategoryListTool.title.ja).toBeTruthy();
    expect(recipeCategoryListTool.description.en.length).toBeGreaterThan(20);
  });
  it("defaults level to 'all'", () => {
    const parsed = recipeCategoryListTool.inputSchema.parse({});
    expect(parsed.level).toBe("all");
  });
  it("rejects an unknown level", () => {
    const parse = () => recipeCategoryListTool.inputSchema.parse({ level: "extra-large" });
    expect(parse).toThrow();
  });
});

describe("recipeCategoryList — handler behaviour", () => {
  it("returns large/medium/small arrays on level='all'", async () => {
    server.use(recipeCategoryListSuccess());
    const result = await recipeCategoryListTool.handler({ level: "all" }, testConfig);
    const r = result as {
      large: Array<{ categoryId: string; categoryName: string }>;
      medium: Array<{ categoryId: string; parentCategoryId: string }>;
      small: Array<{ categoryId: string; parentCategoryId: string }>;
    };
    expect(r.large.length).toBeGreaterThan(0);
    expect(r.medium.length).toBeGreaterThan(r.large.length);
    expect(r.small.length).toBeGreaterThan(r.medium.length);
    expect(r.large[0].categoryId).toBeTruthy();
    expect(r.medium[0].parentCategoryId).toBeTruthy();
  });

  it("returns only the requested depth", async () => {
    server.use(recipeCategoryListSuccess());
    const result = await recipeCategoryListTool.handler({ level: "large" }, testConfig);
    const r = result as { large: unknown[]; medium: unknown[]; small: unknown[] };
    expect(r.large.length).toBeGreaterThan(0);
    expect(r.medium).toEqual([]);
    expect(r.small).toEqual([]);
  });

  it("throws RakutenBadRequestError on 400", async () => {
    server.use(recipeCategoryListAuthInvalid());
    await expect(
      recipeCategoryListTool.handler({ level: "all" }, testConfig),
    ).rejects.toBeInstanceOf(RakutenBadRequestError);
  });

  it("retries 5xx then throws RakutenServerError", async () => {
    server.use(recipeCategoryListServerError());
    await expect(
      recipeCategoryListTool.handler({ level: "all" }, testConfig),
    ).rejects.toBeInstanceOf(RakutenServerError);
  });
});

describe("recipeCategoryRanking", () => {
  it("registers and is bilingual", () => {
    expect(recipeCategoryRankingTool.name).toBe("recipe_category_ranking");
    expect(recipeCategoryRankingTool.title.ja).toBeTruthy();
  });

  it("rejects missing categoryId", () => {
    const parse = () => recipeCategoryRankingTool.inputSchema.parse({});
    expect(parse).toThrow();
  });

  it("returns ranked recipes with title, materials, and URL", async () => {
    server.use(recipeCategoryRankingSuccess());
    const result = await recipeCategoryRankingTool.handler({ categoryId: "30" }, testConfig);
    const r = result as {
      categoryId: string;
      recipes: Array<{
        rank: number;
        recipeId: number;
        recipeTitle: string;
        recipeMaterial: string[];
        recipeUrl: string;
      }>;
    };
    expect(r.categoryId).toBe("30");
    expect(r.recipes.length).toBeGreaterThan(0);
    expect(r.recipes[0].recipeTitle.length).toBeGreaterThan(0);
    expect(Array.isArray(r.recipes[0].recipeMaterial)).toBe(true);
    expect(r.recipes[0].recipeUrl).toContain("recipe.rakuten.co.jp");
  });

  it("throws RakutenBadRequestError on 400", async () => {
    server.use(recipeCategoryRankingAuthInvalid());
    await expect(
      recipeCategoryRankingTool.handler({ categoryId: "30" }, testConfig),
    ).rejects.toBeInstanceOf(RakutenBadRequestError);
  });
});
