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
