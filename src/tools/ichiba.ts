/**
 * Ichiba (Rakuten's e-commerce marketplace) tools.
 *
 * Host: openapi.rakuten.co.jp (new platform, required for UUID-format App IDs).
 *
 * Verified live 2026-06-04 against the user's credentials. Each tool's path
 * prefix differs by endpoint family:
 *   - IchibaItem/Search    →  /ichibams/api/IchibaItem/Search/20260401
 *   - IchibaGenre/Search   →  /ichibagt/api/IchibaGenre/Search/20260401
 *   - IchibaTag/Search     →  /ichibagt/api/IchibaTag/Search/20140222
 *   - IchibaItem/Ranking   →  /ichibaranking/api/IchibaItem/Ranking/20220601
 *   - Product/Search       →  /ichibaproduct/api/Product/Search/20250801
 *
 * The 2026-04 platform migration changed:
 *   - host (openapi.rakuten.co.jp, not app.rakuten.co.jp)
 *   - path roots (/ichibaXXX/api/, not /services/api/)
 *   - IchibaGenre response shape (flat ancestors/genre/siblings/children,
 *     not wrapped parent/child)
 *   - IchibaTag input contract (tagId only — genreId listing mode dropped)
 */

import { z } from "zod";
import { HOST_OPENAPI } from "../config.js";
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
        host: HOST_OPENAPI,
        path: "/ichibams/api/IchibaItem/Search/20260401",
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
}

export interface IchibaGenreSearchResult {
  current: IchibaGenreNode;
  ancestors: IchibaGenreNode[];
  siblings: IchibaGenreNode[];
  children: IchibaGenreNode[];
}

interface RawGenreNode {
  genreId?: number | string;
  nameJa?: string;
  level?: number;
  /** Legacy shape kept as fallback for any older response. */
  genreName?: string;
  genreLevel?: number;
}

interface RawGenreSearchResponse {
  /** 2026-04+ flat shape. */
  genre?: RawGenreNode;
  ancestors?: RawGenreNode[];
  siblings?: RawGenreNode[];
  children?: RawGenreNode[] | Array<{ child: RawGenreNode }>;
}

function mapGenre(raw: RawGenreNode | undefined): IchibaGenreNode {
  return {
    genreId: String(raw?.genreId ?? "0"),
    genreName: raw?.nameJa ?? raw?.genreName ?? "",
    genreLevel: raw?.level ?? raw?.genreLevel ?? 0,
  };
}

/**
 * Children come back flat ({genreId, nameJa, level}) on 20260401 but the
 * older 20140222 shape wrapped each child as {child: {…}}. Accept both.
 */
function unwrapNode(node: RawGenreNode | { child?: RawGenreNode }): RawGenreNode | undefined {
  if (!node) return undefined;
  if ("child" in node && node.child) return node.child;
  return node as RawGenreNode;
}

export const ichibaGenreSearchTool: ToolDefinition<typeof genreSearchInput> = {
  name: "ichiba_genre_search",
  title: bilingual(
    "Browse Rakuten Ichiba Genres",
    "楽天市場のジャンルを参照",
  ),
  description: bilingual(
    "Browse the Rakuten Ichiba genre (category) hierarchy. Pass '0' to list top-level genres, or a specific genre ID to fetch its ancestors, siblings, and direct children. Useful for narrowing item searches to a specific category, or for discovering what categories exist.",
    "楽天市場のジャンル(カテゴリ)階層を参照します。'0' を渡すとトップレベル、特定のジャンルIDを渡すと祖先・兄弟・直下の子ジャンルを取得します。商品検索を特定カテゴリに絞り込んだり、カテゴリ構造を発見するのに使えます。",
  ),
  inputSchema: genreSearchInput,
  async handler(args, config) {
    const raw = await rakutenRequest<RawGenreSearchResponse>(
      {
        host: HOST_OPENAPI,
        path: "/ichibagt/api/IchibaGenre/Search/20260401",
        params: { genreId: args.genre_id },
      },
      config,
    );

    const result: IchibaGenreSearchResult = {
      current: mapGenre(raw.genre),
      ancestors: (raw.ancestors ?? []).map((n) => mapGenre(unwrapNode(n))),
      siblings: (raw.siblings ?? []).map((n) => mapGenre(unwrapNode(n))),
      children: (raw.children ?? []).map((n) => mapGenre(unwrapNode(n))),
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
    .describe(
      "Tag ID to fetch details for. Tag IDs are discoverable from ichiba_item_search responses (each item carries tagIds) and from ichiba_genre_search. タグID。ichiba_item_search のレスポンス内 tagIds や ichiba_genre_search から取得できます。",
    ),
});

export interface IchibaTag {
  tagId: number;
  tagName: string;
  parentTagId?: number;
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
  tag?: { tagId?: number; tagName?: string; parentTagId?: number };
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
      parentTagId: t.tag?.parentTagId,
    })),
  };
}

export const ichibaTagSearchTool: ToolDefinition<typeof tagSearchInput> = {
  name: "ichiba_tag_search",
  title: bilingual(
    "Look up Rakuten Ichiba Tag Details",
    "楽天市場のタグ詳細を参照",
  ),
  description: bilingual(
    "Look up details for a specific Rakuten Ichiba tag by tag ID. Tags are facet-style attributes (size, color, etc.) attached to items. Returns the tag group this tag belongs to, the tag name, and any parent tag. Tag IDs surface in ichiba_item_search item responses (each item carries an attributeIds array) and in ichiba_genre_search.",
    "特定のタグIDの詳細を取得します。タグはファセット属性(サイズ、色など)で商品に紐づいています。タグ名、所属タググループ、親タグを返します。タグIDは ichiba_item_search の各商品 attributeIds や ichiba_genre_search から取得できます。",
  ),
  inputSchema: tagSearchInput,
  async handler(args, config) {
    const raw = await rakutenRequest<RawTagSearchResponse>(
      {
        host: HOST_OPENAPI,
        path: "/ichibagt/api/IchibaTag/Search/20140222",
        params: { tagId: String(args.tag_id) },
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
        host: HOST_OPENAPI,
        path: "/ichibaranking/api/IchibaItem/Ranking/20220601",
        params,
      },
      config,
    );

    // Rakuten returns the page in descending rank order (e.g. 30 → 1 on page 1).
    // Present in natural ascending order so item[0] is rank 1 on page 1.
    const mapped = (raw.Items ?? []).map((r) => ({
      ...mapItem(r as RawItem),
      rank: r.Item.rank ?? 0,
    }));
    mapped.sort((a, b) => a.rank - b.rank);

    const result: IchibaItemRankingResult = {
      title: raw.title ?? "",
      lastBuildDate: raw.lastBuildDate ?? "",
      items: mapped,
    };

    return result;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// ichiba_product_search — Item Price Navi (cross-seller product comparison)
// ──────────────────────────────────────────────────────────────────────────────

const PRODUCT_SORT_OPTIONS = [
  "standard",
  "+reviewCount",
  "-reviewCount",
  "+reviewAverage",
  "-reviewAverage",
  "+averagePrice",
  "-averagePrice",
  "+releaseDate",
  "-releaseDate",
] as const;

const productSearchInput = z.object({
  keyword: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Product keyword. Required unless product_id is provided. 商品キーワード。product_id 省略時は必須。",
    ),
  product_id: z
    .string()
    .optional()
    .describe(
      "Specific product ID (format like '1:12345'). When provided, returns that product. 特定の商品ID。指定時はその商品を返します。",
    ),
  genre_id: z
    .string()
    .optional()
    .describe(
      "Restrict results to a specific genre. ジャンルIDで絞り込み。",
    ),
  maker_code: z
    .string()
    .optional()
    .describe(
      "Restrict results to a specific manufacturer (maker code). メーカーコードで絞り込み。",
    ),
  hits: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(10)
    .describe(
      "Number of results per page (1–30, default 10). 1ページあたりの取得件数。",
    ),
  page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(1)
    .describe(
      "Page number (1+, default 1). ページ番号。",
    ),
  sort: z
    .enum(PRODUCT_SORT_OPTIONS)
    .default("standard")
    .describe(
      "Sort order. '+' ascending, '-' descending. 並び順。",
    ),
});

/**
 * Product Search differs from Item Search in that Rakuten aggregates across all
 * sellers of the same physical product, exposing min/max/average price for
 * cross-seller comparison — useful for "is this a fair price?" workflows.
 */
export interface IchibaProduct {
  /** Opaque hash ID introduced in the 2025-08 endpoint version. */
  productId: string;
  /** JAN/EAN-like product code. May be null for some catalog entries. */
  productCode?: string;
  /** Legacy product number — frequently null on the new endpoint. */
  productNo?: string;
  productName: string;
  productCaption?: string;
  brandName?: string;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  /** Sale-only price range (excludes regular-price listings). */
  salesMinPrice?: number;
  salesMaxPrice?: number;
  itemCount: number;
  salesItemCount?: number;
  productImageUrl?: string;
  productUrlPC?: string;
  productUrlMobile?: string;
  makerName?: string;
  makerCode?: string;
  genreId?: string;
  genreName?: string;
  reviewCount: number;
  reviewAverage: number | string;
  releaseDate?: string;
}

export interface IchibaProductSearchResult {
  count: number;
  page: number;
  first: number;
  last: number;
  hits: number;
  pageCount: number;
  products: IchibaProduct[];
}

interface RawProduct {
  Product: {
    productId?: string;
    productCode?: string | null;
    productNo?: string | null;
    productName?: string;
    productCaption?: string;
    brandName?: string | null;
    averagePrice?: number;
    minPrice?: number;
    maxPrice?: number;
    salesMinPrice?: number;
    salesMaxPrice?: number;
    itemCount?: number;
    salesItemCount?: number;
    /** New endpoint exposes mediumImageUrl as a string, not an array. */
    mediumImageUrl?: string;
    /** Legacy field kept for the old wrapped shape, just in case. */
    productImageUrl?: string;
    productUrlPC?: string;
    productUrlMobile?: string;
    makerName?: string;
    makerCode?: string | number;
    genreId?: string | number;
    genreName?: string;
    reviewCount?: number;
    reviewAverage?: number | string;
    releaseDate?: string;
  };
}

interface RawProductSearchResponse {
  count?: number;
  page?: number;
  first?: number;
  last?: number;
  hits?: number;
  pageCount?: number;
  Products?: RawProduct[];
}

function mapProduct(raw: RawProduct): IchibaProduct {
  const p = raw.Product;
  return {
    productId: p.productId ?? "",
    productCode: p.productCode ?? undefined,
    productNo: p.productNo ?? undefined,
    productName: p.productName ?? "",
    productCaption: p.productCaption,
    brandName: p.brandName ?? undefined,
    averagePrice: p.averagePrice ?? 0,
    minPrice: p.minPrice ?? 0,
    maxPrice: p.maxPrice ?? 0,
    salesMinPrice: p.salesMinPrice,
    salesMaxPrice: p.salesMaxPrice,
    itemCount: p.itemCount ?? 0,
    salesItemCount: p.salesItemCount,
    productImageUrl: p.mediumImageUrl ?? p.productImageUrl,
    productUrlPC: p.productUrlPC,
    productUrlMobile: p.productUrlMobile,
    makerName: p.makerName,
    makerCode: p.makerCode !== undefined ? String(p.makerCode) : undefined,
    genreId: p.genreId !== undefined ? String(p.genreId) : undefined,
    genreName: p.genreName,
    reviewCount: p.reviewCount ?? 0,
    reviewAverage: p.reviewAverage ?? 0,
    releaseDate: p.releaseDate,
  };
}

export const ichibaProductSearchTool: ToolDefinition<typeof productSearchInput> = {
  name: "ichiba_product_search",
  title: bilingual(
    "Search Rakuten Ichiba Products (Cross-Seller, with Min/Max Pricing)",
    "楽天市場の商品検索(複数店舗横断、最安値/平均価格)",
  ),
  description: bilingual(
    "Search Rakuten's Item Price Navi — cross-seller product catalogue that groups identical products across multiple shops. Returns each product with its min/max/average price across all sellers and the total number of shops carrying it. Use this (instead of ichiba_item_search) when you want to compare prices for a specific product or answer 'is this a fair price?'. Filter by maker_code to restrict to a brand.",
    "楽天市場の商品価格ナビを検索します。同一商品を複数店舗にまたがって集約し、最安値/最高値/平均価格と取扱店舗数を返します。特定商品の価格比較や「妥当な価格か?」を判断する用途では、ichiba_item_search ではなくこちらを使用してください。maker_code でブランド絞り込みも可能。",
  ),
  inputSchema: productSearchInput,
  async handler(args, config) {
    if (!args.keyword && !args.product_id) {
      throw new Error(
        "Either keyword or product_id is required. keyword か product_id のいずれかが必要です。",
      );
    }

    const params: Record<string, string> = {
      hits: String(args.hits),
      page: String(args.page),
      sort: args.sort,
    };
    if (args.keyword) params.keyword = args.keyword;
    if (args.product_id) params.productId = args.product_id;
    if (args.genre_id) params.genreId = args.genre_id;
    if (args.maker_code) params.makerCode = args.maker_code;

    const raw = await rakutenRequest<RawProductSearchResponse>(
      {
        host: HOST_OPENAPI,
        path: "/ichibaproduct/api/Product/Search/20250801",
        params,
      },
      config,
    );

    const result: IchibaProductSearchResult = {
      count: raw.count ?? 0,
      page: raw.page ?? args.page,
      first: raw.first ?? 0,
      last: raw.last ?? 0,
      hits: raw.hits ?? args.hits,
      pageCount: raw.pageCount ?? 0,
      products: (raw.Products ?? []).map(mapProduct),
    };

    return result;
  },
};
