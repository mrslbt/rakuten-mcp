/**
 * Recipe (Rakuten Recipe — user-submitted Japanese recipes) tools.
 *
 * Host: openapi.rakuten.co.jp (verified live 2026-06-04).
 * Path root: /recipems/api/Recipe/...
 *
 *   - Recipe/CategoryList/20170426    — full 3-level category tree
 *   - Recipe/CategoryRanking/20170426 — top recipes in a category
 *
 * Response wrapper: both endpoints wrap data under a top-level `result` key
 * instead of the `Items` envelope. CategoryList's `result` is an object with
 * `large/medium/small` arrays; CategoryRanking's `result` is a flat array.
 */

import { z } from "zod";
import { HOST_OPENAPI } from "../config.js";
import { rakutenRequest } from "../client.js";
import { bilingual } from "../i18n.js";
import type { ToolDefinition } from "./types.js";

// ──────────────────────────────────────────────────────────────────────────────
// recipe_category_list
// ──────────────────────────────────────────────────────────────────────────────

const categoryListInput = z.object({
  level: z
    .enum(["all", "large", "medium", "small"])
    .default("all")
    .describe(
      "Which depth(s) to return. 'all' returns the full tree (~2000 categories, ~430KB). Use 'large' for the 43 top-level categories only. 取得階層。'all' は全階層(約2000カテゴリ、430KB)、'large' はトップレベル43件のみ。",
    ),
});

export interface RecipeCategoryLarge {
  categoryId: string;
  categoryName: string;
  categoryUrl: string;
}
export interface RecipeCategoryMediumOrSmall extends RecipeCategoryLarge {
  parentCategoryId: string;
}

export interface RecipeCategoryListResult {
  large: RecipeCategoryLarge[];
  medium: RecipeCategoryMediumOrSmall[];
  small: RecipeCategoryMediumOrSmall[];
}

interface RawCategoryListResponse {
  result?: {
    large?: Array<{ categoryId?: string | number; categoryName?: string; categoryUrl?: string }>;
    medium?: Array<{
      categoryId?: string | number;
      categoryName?: string;
      categoryUrl?: string;
      parentCategoryId?: string | number;
    }>;
    small?: Array<{
      categoryId?: string | number;
      categoryName?: string;
      categoryUrl?: string;
      parentCategoryId?: string | number;
    }>;
  };
}

export const recipeCategoryListTool: ToolDefinition<typeof categoryListInput> = {
  name: "recipe_category_list",
  title: bilingual("List Rakuten Recipe Categories", "楽天レシピのカテゴリ一覧"),
  description: bilingual(
    "Get the full Rakuten Recipe category hierarchy (43 large → ~540 medium → ~1500 small categories). Each category has a categoryId, name, and URL on recipe.rakuten.co.jp. Use 'large' depth when you only need the top-level menu (much smaller payload). Medium and small categories include parentCategoryId for tree assembly.",
    "楽天レシピのカテゴリ階層(43大カテゴリ→約540中カテゴリ→約1500小カテゴリ)を取得します。各カテゴリにID、名前、recipe.rakuten.co.jp のURLが付きます。トップレベルだけ必要な場合は 'large' を指定(ペイロード大幅小)。中・小には parentCategoryId が付与されます。",
  ),
  inputSchema: categoryListInput,
  async handler(args, config) {
    const raw = await rakutenRequest<RawCategoryListResponse>(
      {
        host: HOST_OPENAPI,
        path: "/recipems/api/Recipe/CategoryList/20170426",
        params: {},
      },
      config,
    );
    const r = raw.result ?? {};
    const large = (r.large ?? []).map((c) => ({
      categoryId: String(c.categoryId ?? ""),
      categoryName: c.categoryName ?? "",
      categoryUrl: c.categoryUrl ?? "",
    }));
    const mapMS = (
      arr: NonNullable<RawCategoryListResponse["result"]>["medium"] | undefined,
    ): RecipeCategoryMediumOrSmall[] =>
      (arr ?? []).map((c) => ({
        categoryId: String(c.categoryId ?? ""),
        categoryName: c.categoryName ?? "",
        categoryUrl: c.categoryUrl ?? "",
        parentCategoryId: String(c.parentCategoryId ?? ""),
      }));

    const result: RecipeCategoryListResult = {
      large: args.level === "all" || args.level === "large" ? large : [],
      medium: args.level === "all" || args.level === "medium" ? mapMS(r.medium) : [],
      small: args.level === "all" || args.level === "small" ? mapMS(r.small) : [],
    };
    return result;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// recipe_category_ranking
// ──────────────────────────────────────────────────────────────────────────────

const categoryRankingInput = z.object({
  categoryId: z
    .string()
    .min(1)
    .describe(
      "Category ID to rank within. Pass a large/medium/small categoryId from recipe_category_list. ランキング対象のカテゴリID(recipe_category_list の large/medium/small から取得)。",
    ),
});

export interface RecipeRanked {
  rank: number;
  recipeId: number;
  recipeTitle: string;
  recipeUrl: string;
  recipeDescription?: string;
  recipeMaterial: string[];
  recipeIndication?: string;
  recipeCost?: string;
  recipePublishday?: string;
  foodImageUrl?: string;
  mediumImageUrl?: string;
  smallImageUrl?: string;
  nickname?: string;
  shop?: number;
  pickup?: number;
}

export interface RecipeCategoryRankingResult {
  categoryId: string;
  recipes: RecipeRanked[];
}

interface RawRankedRecipe {
  rank?: number | string;
  recipeId?: number;
  recipeTitle?: string;
  recipeUrl?: string;
  recipeDescription?: string;
  recipeMaterial?: string[];
  recipeIndication?: string;
  recipeCost?: string;
  recipePublishday?: string;
  foodImageUrl?: string;
  mediumImageUrl?: string;
  smallImageUrl?: string;
  nickname?: string;
  shop?: number;
  pickup?: number;
}

interface RawCategoryRankingResponse {
  result?: RawRankedRecipe[];
}

export const recipeCategoryRankingTool: ToolDefinition<typeof categoryRankingInput> = {
  name: "recipe_category_ranking",
  title: bilingual("Get Rakuten Recipe Category Ranking", "楽天レシピのカテゴリランキング"),
  description: bilingual(
    "Get the top recipes in a Rakuten Recipe category. Returns ranked recipes with title, ingredient list, cooking time (indication), cost estimate, image URLs, author nickname, and a direct URL to recipe.rakuten.co.jp. Use recipe_category_list to find category IDs.",
    "指定カテゴリの楽天レシピ人気ランキングを取得します。順位、タイトル、材料一覧、調理時間目安、費用目安、画像、投稿者ニックネーム、レシピURLを返します。カテゴリIDは recipe_category_list で取得。",
  ),
  inputSchema: categoryRankingInput,
  async handler(args, config) {
    const raw = await rakutenRequest<RawCategoryRankingResponse>(
      {
        host: HOST_OPENAPI,
        path: "/recipems/api/Recipe/CategoryRanking/20170426",
        params: { categoryId: args.categoryId },
      },
      config,
    );
    return {
      categoryId: args.categoryId,
      recipes: (raw.result ?? []).map((r) => ({
        rank: typeof r.rank === "string" ? Number(r.rank) : r.rank ?? 0,
        recipeId: r.recipeId ?? 0,
        recipeTitle: r.recipeTitle ?? "",
        recipeUrl: r.recipeUrl ?? "",
        recipeDescription: r.recipeDescription,
        recipeMaterial: r.recipeMaterial ?? [],
        recipeIndication: r.recipeIndication,
        recipeCost: r.recipeCost,
        recipePublishday: r.recipePublishday,
        foodImageUrl: r.foodImageUrl,
        mediumImageUrl: r.mediumImageUrl,
        smallImageUrl: r.smallImageUrl,
        nickname: r.nickname,
        shop: r.shop,
        pickup: r.pickup,
      })),
    } satisfies RecipeCategoryRankingResult;
  },
};
