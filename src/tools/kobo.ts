/**
 * Kobo (Rakuten Kobo eBook store) tools.
 *
 * Host: openapi.rakuten.co.jp (verified live 2026-06-04).
 *
 *   - Kobo/EbookSearch/20170426  → /services/api/Kobo/EbookSearch/20170426
 *   - Kobo/GenreSearch/20131010  → /services/api/Kobo/GenreSearch/20131010
 *
 * GenreSearch uses the legacy wrapped {parent}/{child} shape (same family as
 * BooksGenre and pre-migration IchibaGenre). Top-level Kobo genre is '101'
 * (電子書籍) — passing '0' or '000' returns "the genre id is not valid".
 */

import { z } from "zod";
import { HOST_OPENAPI } from "../config.js";
import { rakutenRequest } from "../client.js";
import { bilingual } from "../i18n.js";
import type { ToolDefinition } from "./types.js";

// ──────────────────────────────────────────────────────────────────────────────
// kobo_ebook_search
// ──────────────────────────────────────────────────────────────────────────────

const KOBO_SORT_OPTIONS = [
  "standard",
  "sales",
  "+releaseDate",
  "-releaseDate",
  "+itemPrice",
  "-itemPrice",
  "reviewCount",
  "reviewAverage",
] as const;

const ebookSearchInput = z.object({
  keyword: z.string().optional().describe("Free-text keyword. キーワード。"),
  title: z.string().optional().describe("Title (partial match). タイトル(部分一致)。"),
  author: z.string().optional().describe("Author name. 著者名。"),
  publisherName: z.string().optional().describe("Publisher name. 出版社。"),
  koboGenreId: z.string().optional().describe("Restrict to a Kobo genre ID. Use kobo_genre_search to discover. ジャンルIDで絞り込み。"),
  hits: z.number().int().min(1).max(30).default(10).describe("Results per page. 取得件数。"),
  page: z.number().int().min(1).max(100).default(1).describe("Page number. ページ番号。"),
  sort: z.enum(KOBO_SORT_OPTIONS).default("standard").describe("Sort order. 並び順。"),
}).refine(
  (v) => v.keyword || v.title || v.author || v.publisherName || v.koboGenreId,
  { message: "At least one of keyword/title/author/publisherName/koboGenreId is required. いずれか必須。" },
);

interface RawKoboItem {
  title?: string;
  titleKana?: string;
  subTitle?: string;
  seriesName?: string;
  author?: string;
  authorKana?: string;
  publisherName?: string;
  itemPrice?: number;
  itemUrl?: string;
  itemNumber?: string;
  itemCaption?: string;
  salesDate?: string;
  salesType?: number;
  koboGenreId?: string;
  language?: string;
  reviewCount?: number;
  reviewAverage?: number | string;
  smallImageUrl?: string;
  mediumImageUrl?: string;
  largeImageUrl?: string;
  affiliateUrl?: string;
}

export interface KoboEbookItem {
  title: string;
  subTitle?: string;
  seriesName?: string;
  author?: string;
  publisherName?: string;
  itemPrice: number;
  itemUrl: string;
  itemNumber?: string;
  itemCaption?: string;
  salesDate?: string;
  salesType?: number;
  koboGenreId?: string;
  /** ISO-639-style language code (e.g. "EN", "JA"). */
  language?: string;
  reviewCount: number;
  reviewAverage: number | string;
  imageUrl?: string;
}

interface RawKoboSearchResponse {
  count?: number;
  page?: number;
  first?: number;
  last?: number;
  hits?: number;
  pageCount?: number;
  Items?: Array<{ Item: RawKoboItem }>;
}

export interface KoboEbookSearchResult {
  count: number;
  page: number;
  first: number;
  last: number;
  hits: number;
  pageCount: number;
  items: KoboEbookItem[];
}

function mapKoboItem(r: RawKoboItem): KoboEbookItem {
  return {
    title: r.title ?? "",
    subTitle: r.subTitle || undefined,
    seriesName: r.seriesName || undefined,
    author: r.author || undefined,
    publisherName: r.publisherName,
    itemPrice: r.itemPrice ?? 0,
    itemUrl: r.itemUrl ?? "",
    itemNumber: r.itemNumber,
    itemCaption: r.itemCaption,
    salesDate: r.salesDate,
    salesType: r.salesType,
    koboGenreId: r.koboGenreId,
    language: r.language,
    reviewCount: r.reviewCount ?? 0,
    reviewAverage: r.reviewAverage ?? 0,
    imageUrl: r.mediumImageUrl ?? r.largeImageUrl ?? r.smallImageUrl,
  };
}

export const koboEbookSearchTool: ToolDefinition<typeof ebookSearchInput> = {
  name: "kobo_ebook_search",
  title: bilingual("Search Rakuten Kobo eBooks", "楽天Koboで電子書籍を検索"),
  description: bilingual(
    "Search Rakuten Kobo's eBook catalogue by keyword, title, author, publisher, or genre. Returns eBook details with title, series, author, publisher, price, sale URL, language code, image URL, and review stats. Pass at least one search field.",
    "楽天Kobo電子書籍カタログを、キーワード/タイトル/著者/出版社/ジャンルで検索します。タイトル、シリーズ、著者、出版社、価格、購入URL、言語、画像、レビューを含む書籍詳細を返します。検索条件は1つ以上必須。",
  ),
  inputSchema: ebookSearchInput,
  async handler(args, config) {
    const params: Record<string, string> = {
      hits: String(args.hits),
      page: String(args.page),
      sort: args.sort,
    };
    if (args.keyword) params.keyword = args.keyword;
    if (args.title) params.title = args.title;
    if (args.author) params.author = args.author;
    if (args.publisherName) params.publisherName = args.publisherName;
    if (args.koboGenreId) params.koboGenreId = args.koboGenreId;

    const raw = await rakutenRequest<RawKoboSearchResponse>(
      { host: HOST_OPENAPI, path: "/services/api/Kobo/EbookSearch/20170426", params },
      config,
    );
    return {
      count: raw.count ?? 0,
      page: raw.page ?? args.page,
      first: raw.first ?? 0,
      last: raw.last ?? 0,
      hits: raw.hits ?? args.hits,
      pageCount: raw.pageCount ?? 0,
      items: (raw.Items ?? []).map((w) => mapKoboItem(w.Item)),
    } satisfies KoboEbookSearchResult;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// kobo_genre_search — wrapped legacy shape, top-level ID is '101' (not 0/000)
// ──────────────────────────────────────────────────────────────────────────────

const genreSearchInput = z.object({
  koboGenreId: z
    .string()
    .default("101")
    .describe(
      "Kobo genre ID. Top-level is '101' (電子書籍). Drill down with returned child IDs. ジャンルID。トップは '101'(電子書籍)。子IDで掘り下げ。",
    ),
});

export interface KoboGenreNode {
  koboGenreId: string;
  koboGenreName: string;
  genreLevel: number;
}

export interface KoboGenreSearchResult {
  current: KoboGenreNode;
  parents: KoboGenreNode[];
  children: KoboGenreNode[];
}

interface RawKoboGenreNode {
  koboGenreId?: string | number;
  koboGenreName?: string;
  genreLevel?: number;
}

interface RawKoboGenreSearchResponse {
  current?: RawKoboGenreNode;
  parents?: Array<{ parent: RawKoboGenreNode }>;
  children?: Array<{ child: RawKoboGenreNode }>;
}

function mapKoboGenre(raw: RawKoboGenreNode | undefined): KoboGenreNode {
  return {
    koboGenreId: String(raw?.koboGenreId ?? ""),
    koboGenreName: raw?.koboGenreName ?? "",
    genreLevel: raw?.genreLevel ?? 0,
  };
}

export const koboGenreSearchTool: ToolDefinition<typeof genreSearchInput> = {
  name: "kobo_genre_search",
  title: bilingual("Browse Rakuten Kobo Genres", "楽天Koboのジャンルを参照"),
  description: bilingual(
    "Browse the Rakuten Kobo eBook genre hierarchy. Top-level is '101' (電子書籍). Pass a child genre ID returned by this tool to drill down. Returns the current genre, its ancestors, and its direct children — useful for narrowing kobo_ebook_search results.",
    "楽天Koboのジャンル階層を参照します。最上位は '101'(電子書籍)。子IDを渡して掘り下げ可能。現在のジャンル、祖先、子ジャンルを返します。kobo_ebook_search の絞り込みに利用してください。",
  ),
  inputSchema: genreSearchInput,
  async handler(args, config) {
    const raw = await rakutenRequest<RawKoboGenreSearchResponse>(
      {
        host: HOST_OPENAPI,
        path: "/services/api/Kobo/GenreSearch/20131010",
        params: { koboGenreId: args.koboGenreId },
      },
      config,
    );
    return {
      current: mapKoboGenre(raw.current),
      parents: (raw.parents ?? []).map((p) => mapKoboGenre(p.parent)),
      children: (raw.children ?? []).map((c) => mapKoboGenre(c.child)),
    } satisfies KoboGenreSearchResult;
  },
};
