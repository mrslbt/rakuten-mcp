/**
 * Ichiba (Rakuten's e-commerce marketplace) tools.
 *
 * Host: legacy (app.rakuten.co.jp). Verified June 2026 — Ichiba endpoints
 * have not migrated to openapi.rakuten.co.jp yet. Re-check before v1.0.
 */

import { z } from "zod";
import { HOST_LEGACY } from "../config.js";
import { rakutenRequest } from "../client.js";
import { bilingual } from "../i18n.js";
import type { ToolDefinition } from "./types.js";

// ──────────────────────────────────────────────────────────────────────────────
// ichiba_item_search — Search products on Rakuten Ichiba
// ──────────────────────────────────────────────────────────────────────────────

const ICHIBA_SORT_OPTIONS = [
  "standard",
  "+affiliateRate",
  "-affiliateRate",
  "+reviewCount",
  "-reviewCount",
  "+reviewAverage",
  "-reviewAverage",
  "+itemPrice",
  "-itemPrice",
  "+updateTimestamp",
  "-updateTimestamp",
] as const;

const itemSearchInput = z.object({
  keyword: z
    .string()
    .min(1)
    .describe(
      "Search keyword. Accepts Japanese or English. 検索キーワード。日本語または英語。",
    ),
  hits: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(10)
    .describe(
      "Number of results to return per page (1–30, default 10). 1ページあたりの取得件数(1〜30、デフォルト10)。",
    ),
  page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(1)
    .describe(
      "Page number (1+, default 1). ページ番号(1以上、デフォルト1)。",
    ),
  sort: z
    .enum(ICHIBA_SORT_OPTIONS)
    .default("standard")
    .describe(
      "Sort order. Prefix '+' = ascending, '-' = descending. 並び順。'+' は昇順、'-' は降順。",
    ),
  min_price: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Minimum price in JPY (integer, inclusive). 最低価格(円、整数、以上)。",
    ),
  max_price: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Maximum price in JPY (integer, inclusive). 最高価格(円、整数、以下)。",
    ),
  genre_id: z
    .string()
    .optional()
    .describe(
      "Restrict to a specific genre ID. Browse genres via ichiba_genre_search. ジャンルIDで絞り込み。",
    ),
  shop_code: z
    .string()
    .optional()
    .describe(
      "Restrict to a specific shop. 特定の店舗で絞り込み。",
    ),
});

export interface IchibaItem {
  itemName: string;
  itemPrice: number;
  itemUrl: string;
  shopName: string;
  shopCode: string;
  itemCode: string;
  reviewAverage: number | string;
  reviewCount: number;
  imageUrl: string | undefined;
  availability: number;
  taxFlag: number;
  postageFlag: number;
  pointRate: number;
  pointRateStartTime?: string;
  pointRateEndTime?: string;
}

export interface IchibaItemSearchResult {
  count: number;
  page: number;
  first: number;
  last: number;
  hits: number;
  pageCount: number;
  items: IchibaItem[];
}

interface RawItem {
  Item: {
    itemName?: string;
    itemPrice?: number;
    itemUrl?: string;
    shopName?: string;
    shopCode?: string;
    itemCode?: string;
    reviewAverage?: number | string;
    reviewCount?: number;
    mediumImageUrls?: Array<{ imageUrl: string }>;
    availability?: number;
    taxFlag?: number;
    postageFlag?: number;
    pointRate?: number;
    pointRateStartTime?: string;
    pointRateEndTime?: string;
  };
}

interface RawItemSearchResponse {
  count?: number;
  page?: number;
  first?: number;
  last?: number;
  hits?: number;
  pageCount?: number;
  Items?: RawItem[];
}

function mapItem(raw: RawItem): IchibaItem {
  const i = raw.Item;
  return {
    itemName: i.itemName ?? "",
    itemPrice: i.itemPrice ?? 0,
    itemUrl: i.itemUrl ?? "",
    shopName: i.shopName ?? "",
    shopCode: i.shopCode ?? "",
    itemCode: i.itemCode ?? "",
    reviewAverage: i.reviewAverage ?? 0,
    reviewCount: i.reviewCount ?? 0,
    imageUrl: i.mediumImageUrls?.[0]?.imageUrl,
    availability: i.availability ?? 0,
    taxFlag: i.taxFlag ?? 0,
    postageFlag: i.postageFlag ?? 0,
    pointRate: i.pointRate ?? 1,
    pointRateStartTime: i.pointRateStartTime,
    pointRateEndTime: i.pointRateEndTime,
  };
}

export const ichibaItemSearchTool: ToolDefinition<typeof itemSearchInput> = {
  name: "ichiba_item_search",
  title: bilingual(
    "Search Rakuten Ichiba Products",
    "楽天市場で商品を検索",
  ),
  description: bilingual(
    "Search products on Rakuten Ichiba (Japan's largest e-commerce marketplace) by keyword. Supports price range filtering, sorting by review count/average/price, and restricting results to a specific genre or shop. Returns a paginated list of items with prices, review stats, images, and direct purchase URLs.",
    "楽天市場(日本最大のEコマースモール)で商品をキーワード検索します。価格範囲フィルタ、レビュー数/平均/価格による並び替え、ジャンルや店舗での絞り込みに対応。価格、レビュー、画像、購入URLを含む商品一覧をページング形式で返します。",
  ),
  inputSchema: itemSearchInput,
  async handler(args, config) {
    const params: Record<string, string> = {
      keyword: args.keyword,
      hits: String(args.hits),
      page: String(args.page),
      sort: args.sort,
    };
    if (args.min_price !== undefined) params.minPrice = String(args.min_price);
    if (args.max_price !== undefined) params.maxPrice = String(args.max_price);
    if (args.genre_id) params.genreId = args.genre_id;
    if (args.shop_code) params.shopCode = args.shop_code;

    const raw = await rakutenRequest<RawItemSearchResponse>(
      {
        host: HOST_LEGACY,
        path: "/services/api/IchibaItem/Search/20220601",
        params,
      },
      config,
    );

    const result: IchibaItemSearchResult = {
      count: raw.count ?? 0,
      page: raw.page ?? args.page,
      first: raw.first ?? 0,
      last: raw.last ?? 0,
      hits: raw.hits ?? args.hits,
      pageCount: raw.pageCount ?? 0,
      items: (raw.Items ?? []).map(mapItem),
    };

    return result;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// ichiba_genre_search — Browse Rakuten Ichiba genre tree
// ──────────────────────────────────────────────────────────────────────────────

const genreSearchInput = z.object({
  genre_id: z
    .string()
    .default("0")
    .describe(
      "Genre ID to query. '0' returns the top-level genres; pass a child genre ID to drill down. ジャンルID。'0' はトップレベル。子ジャンルIDを渡して掘り下げます。",
    ),
});

export interface IchibaGenreNode {
  genreId: string;
  genreName: string;
  genreLevel: number;
  taxonomyId?: number | null;
}

export interface IchibaGenreSearchResult {
  current: IchibaGenreNode;
  parents: IchibaGenreNode[];
  children: IchibaGenreNode[];
}

interface RawGenreNode {
  genreId?: number | string;
  genreName?: string;
  genreLevel?: number;
  taxonomyId?: number | null;
}

interface RawGenreSearchResponse {
  current?: RawGenreNode;
  parents?: Array<{ parent: RawGenreNode }>;
  children?: Array<{ child: RawGenreNode }>;
}

function mapGenre(raw: RawGenreNode | undefined): IchibaGenreNode {
  return {
    genreId: String(raw?.genreId ?? "0"),
    genreName: raw?.genreName ?? "",
    genreLevel: raw?.genreLevel ?? 0,
    taxonomyId: raw?.taxonomyId ?? null,
  };
}

export const ichibaGenreSearchTool: ToolDefinition<typeof genreSearchInput> = {
  name: "ichiba_genre_search",
  title: bilingual(
    "Browse Rakuten Ichiba Genres",
    "楽天市場のジャンルを参照",
  ),
  description: bilingual(
    "Browse the Rakuten Ichiba genre (category) hierarchy. Pass '0' to list top-level genres, or a specific genre ID to fetch its parents and direct children. Useful for narrowing item searches to a specific category, or for discovering what categories exist. Returns the current genre, its ancestors, and its immediate sub-genres.",
    "楽天市場のジャンル(カテゴリ)階層を参照します。'0' を渡すとトップレベル、特定のジャンルIDを渡すと祖先と直下の子ジャンルを取得します。商品検索を特定カテゴリに絞り込んだり、カテゴリ構造を発見するのに使えます。現在のジャンル、祖先、直下の子ジャンルを返します。",
  ),
  inputSchema: genreSearchInput,
  async handler(args, config) {
    const raw = await rakutenRequest<RawGenreSearchResponse>(
      {
        host: HOST_LEGACY,
        path: "/services/api/IchibaGenre/Search/20140222",
        params: { genreId: args.genre_id },
      },
      config,
    );

    const result: IchibaGenreSearchResult = {
      current: mapGenre(raw.current),
      parents: (raw.parents ?? []).map((p) => mapGenre(p.parent)),
      children: (raw.children ?? []).map((c) => mapGenre(c.child)),
    };

    return result;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// ichiba_tag_search — Fetch Rakuten Ichiba tag groups for a genre
// ──────────────────────────────────────────────────────────────────────────────

const tagSearchInput = z.object({
  tag_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Specific tag ID to fetch. If omitted, genre_id is required and tag groups for that genre are returned. 特定のタグID。省略時は genre_id が必須で、そのジャンルのタググループ一覧を返します。",
    ),
  genre_id: z
    .string()
    .optional()
    .describe(
      "Genre ID to list tag groups for. Required when tag_id is omitted. ジャンルID。tag_id 省略時に必須。",
    ),
});

export interface IchibaTag {
  tagId: number;
  tagName: string;
}

export interface IchibaTagGroup {
  tagGroupId: number;
  tagGroupName: string;
  tags: IchibaTag[];
}

export interface IchibaTagSearchResult {
  tagGroups: IchibaTagGroup[];
}

interface RawTag {
  tag?: { tagId?: number; tagName?: string };
}

interface RawTagGroup {
  tagGroup?: {
    tagGroupId?: number;
    tagGroupName?: string;
    tags?: RawTag[];
  };
}

interface RawTagSearchResponse {
  tagGroups?: RawTagGroup[];
}

function mapTagGroup(raw: RawTagGroup): IchibaTagGroup {
  const g = raw.tagGroup ?? {};
  return {
    tagGroupId: g.tagGroupId ?? 0,
    tagGroupName: g.tagGroupName ?? "",
    tags: (g.tags ?? []).map((t) => ({
      tagId: t.tag?.tagId ?? 0,
      tagName: t.tag?.tagName ?? "",
    })),
  };
}

export const ichibaTagSearchTool: ToolDefinition<typeof tagSearchInput> = {
  name: "ichiba_tag_search",
  title: bilingual(
    "Search Rakuten Ichiba Tags",
    "楽天市場のタグを検索",
  ),
  description: bilingual(
    "Fetch tag groups for a Rakuten Ichiba genre, or details for a specific tag ID. Tags are facet-style attributes (color, size, brand, etc.) that can refine a search. Pass tag_id to fetch a specific tag, or genre_id to list all tag groups defined for that genre. Useful for building faceted search UIs or refining ichiba_item_search results.",
    "楽天市場のジャンルに紐づくタググループ、または特定のタグIDの詳細を取得します。タグはファセット型の属性(色、サイズ、ブランドなど)で、検索を絞り込めます。tag_id を渡して特定タグを、または genre_id を渡してそのジャンルに定義された全タググループを取得します。ファセット検索UIの構築や ichiba_item_search の絞り込みに有用です。",
  ),
  inputSchema: tagSearchInput,
  async handler(args, config) {
    if (args.tag_id === undefined && !args.genre_id) {
      throw new Error(
        "Either tag_id or genre_id is required. tag_id か genre_id のいずれかが必要です。",
      );
    }
    const params: Record<string, string> = {};
    if (args.tag_id !== undefined) params.tagId = String(args.tag_id);
    if (args.genre_id) params.genreId = args.genre_id;

    const raw = await rakutenRequest<RawTagSearchResponse>(
      {
        host: HOST_LEGACY,
        path: "/services/api/IchibaTag/Search/20140222",
        params,
      },
      config,
    );

    const result: IchibaTagSearchResult = {
      tagGroups: (raw.tagGroups ?? []).map(mapTagGroup),
    };

    return result;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// ichiba_item_ranking — Get bestseller rankings, overall or by genre
// ──────────────────────────────────────────────────────────────────────────────

const ITEM_RANKING_PERIODS = ["realtime", "daily", "weekly", "monthly", "yearly"] as const;
const ITEM_RANKING_AGES = ["10s", "20s", "30s", "40s", "50s", "60s", "70s"] as const;
const ITEM_RANKING_SEXES = ["female", "male"] as const;

const itemRankingInput = z.object({
  genre_id: z
    .string()
    .default("0")
    .describe(
      "Genre ID for the ranking. '0' returns the overall ranking. 0はジャンル全体のランキング。",
    ),
  page: z
    .number()
    .int()
    .min(1)
    .max(34)
    .default(1)
    .describe(
      "Page number (1–34; Rakuten caps rankings at ~1000 items). ページ番号(1〜34)。",
    ),
  period: z
    .enum(ITEM_RANKING_PERIODS)
    .optional()
    .describe(
      "Time window for the ranking. Default depends on Rakuten's current configuration. ランキングの集計期間。",
    ),
  age: z
    .enum(ITEM_RANKING_AGES)
    .optional()
    .describe(
      "Filter to a specific age demographic (e.g., '20s' = users in their 20s). 年代フィルタ。",
    ),
  sex: z
    .enum(ITEM_RANKING_SEXES)
    .optional()
    .describe(
      "Filter to a specific gender demographic. 性別フィルタ。",
    ),
});

export interface IchibaRankedItem extends IchibaItem {
  rank: number;
}

export interface IchibaItemRankingResult {
  title: string;
  lastBuildDate: string;
  items: IchibaRankedItem[];
}

interface RawRankedItem {
  Item: RawItem["Item"] & { rank?: number };
}

interface RawItemRankingResponse {
  title?: string;
  lastBuildDate?: string;
  Items?: RawRankedItem[];
}

const AGE_TO_PARAM: Record<typeof ITEM_RANKING_AGES[number], string> = {
  "10s": "10",
  "20s": "20",
  "30s": "30",
  "40s": "40",
  "50s": "50",
  "60s": "60",
  "70s": "70",
};

const SEX_TO_PARAM: Record<typeof ITEM_RANKING_SEXES[number], string> = {
  female: "0",
  male: "1",
};

export const ichibaItemRankingTool: ToolDefinition<typeof itemRankingInput> = {
  name: "ichiba_item_ranking",
  title: bilingual(
    "Get Rakuten Ichiba Bestseller Ranking",
    "楽天市場の売れ筋ランキングを取得",
  ),
  description: bilingual(
    "Get the Rakuten Ichiba bestseller ranking — overall or filtered by genre, time period, age, and gender demographic. Returns ranked items with their rank, price, review stats, and purchase URL. Use ichiba_genre_search to find specific genre IDs.",
    "楽天市場の売れ筋ランキングを取得します。総合または、ジャンル/集計期間/年代/性別で絞り込み可能。順位、価格、レビュー、購入URLを含むランキング一覧を返します。ジャンルIDの検索には ichiba_genre_search を使用してください。",
  ),
  inputSchema: itemRankingInput,
  async handler(args, config) {
    const params: Record<string, string> = {
      genreId: args.genre_id,
      page: String(args.page),
    };
    if (args.period) params.period = args.period;
    if (args.age) params.age = AGE_TO_PARAM[args.age];
    if (args.sex) params.sex = SEX_TO_PARAM[args.sex];

    const raw = await rakutenRequest<RawItemRankingResponse>(
      {
        host: HOST_LEGACY,
        path: "/services/api/IchibaItem/Ranking/20220601",
        params,
      },
      config,
    );

    const result: IchibaItemRankingResult = {
      title: raw.title ?? "",
      lastBuildDate: raw.lastBuildDate ?? "",
      items: (raw.Items ?? []).map((r) => ({
        ...mapItem(r as RawItem),
        rank: r.Item.rank ?? 0,
      })),
    };

    return result;
  },
};
