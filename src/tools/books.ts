/**
 * Books (Rakuten's books/CD/DVD/games/software/magazines storefront) tools.
 *
 * Host: openapi.rakuten.co.jp (verified live 2026-06-04).
 *
 *   - BooksTotal/Search/20170404     → /services/api/BooksTotal/Search/20170404
 *   - BooksBook/Search/20170404      → /services/api/BooksBook/Search/20170404
 *   - BooksCD/Search/20170404        → /services/api/BooksCD/Search/20170404
 *   - BooksDVD/Search/20170404       → /services/api/BooksDVD/Search/20170404
 *   - BooksForeignBook/Search/20170404 → /services/api/BooksForeignBook/Search/20170404
 *   - BooksMagazine/Search/20170404  → /services/api/BooksMagazine/Search/20170404
 *   - BooksGame/Search/20170404      → /services/api/BooksGame/Search/20170404
 *   - BooksSoftware/Search/20170404  → /services/api/BooksSoftware/Search/20170404
 *   - BooksGenre/Search/20121128     → /services/api/BooksGenre/Search/20121128
 *
 * Unlike Ichiba, Books retained the legacy `/services/api/` path prefix on the
 * new host. All 8 search endpoints share an identical envelope and we factor
 * out a single `runBooksSearch` helper. BooksGenre still uses the old wrapped
 * {parent}/{child} response shape; the v0 Ichiba mapper pattern applies.
 */

import { z } from "zod";
import { HOST_OPENAPI } from "../config.js";
import { rakutenRequest } from "../client.js";
import { bilingual } from "../i18n.js";
import type { ToolDefinition } from "./types.js";

// ──────────────────────────────────────────────────────────────────────────────
// Shared envelope — every Books search endpoint returns this shape.
// ──────────────────────────────────────────────────────────────────────────────

interface BooksSearchEnvelope<TRawItem> {
  count?: number;
  page?: number;
  first?: number;
  last?: number;
  hits?: number;
  pageCount?: number;
  Items?: Array<{ Item: TRawItem }>;
}

export interface BooksSearchResult<TItem> {
  count: number;
  page: number;
  first: number;
  last: number;
  hits: number;
  pageCount: number;
  items: TItem[];
}

const BOOKS_SORT_OPTIONS = [
  "standard",
  "sales",
  "+releaseDate",
  "-releaseDate",
  "+itemPrice",
  "-itemPrice",
  "reviewCount",
  "reviewAverage",
] as const;

/** Fields common to every Books search input schema. */
const commonSearchFields = {
  hits: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(10)
    .describe(
      "Number of results per page (1–30, default 10). 1ページあたりの取得件数(1〜30、デフォルト10)。",
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
    .enum(BOOKS_SORT_OPTIONS)
    .default("standard")
    .describe(
      "Sort order. 並び順。",
    ),
  booksGenreId: z
    .string()
    .optional()
    .describe(
      "Restrict to a specific Books genre (3-character IDs, hierarchical). Use books_genre_search to discover. ジャンルIDで絞り込み(books_genre_search で取得)。",
    ),
};

async function runBooksSearch<TRawItem, TItem>(
  path: string,
  params: Record<string, string>,
  mapItem: (raw: TRawItem) => TItem,
  config: import("../config.js").Config,
  defaultHits: number,
  defaultPage: number,
): Promise<BooksSearchResult<TItem>> {
  const raw = await rakutenRequest<BooksSearchEnvelope<TRawItem>>(
    { host: HOST_OPENAPI, path, params },
    config,
  );
  return {
    count: raw.count ?? 0,
    page: raw.page ?? defaultPage,
    first: raw.first ?? 0,
    last: raw.last ?? 0,
    hits: raw.hits ?? defaultHits,
    pageCount: raw.pageCount ?? 0,
    items: (raw.Items ?? []).map((wrapper) => mapItem(wrapper.Item)),
  };
}

/** Minimal field set common to every Books item kind. */
interface CommonRawFields {
  title?: string;
  titleKana?: string;
  itemPrice?: number;
  itemUrl?: string;
  itemCaption?: string;
  availability?: number;
  postageFlag?: number;
  reviewCount?: number;
  reviewAverage?: number | string;
  smallImageUrl?: string;
  mediumImageUrl?: string;
  largeImageUrl?: string;
  salesDate?: string;
  listPrice?: number;
  discountPrice?: number;
  discountRate?: number;
  limitedFlag?: number;
  affiliateUrl?: string;
  booksGenreId?: string;
}

interface CommonFields {
  title: string;
  titleKana?: string;
  itemPrice: number;
  itemUrl: string;
  itemCaption?: string;
  availability: number;
  postageFlag: number;
  reviewCount: number;
  reviewAverage: number | string;
  imageUrl?: string;
  salesDate?: string;
  listPrice?: number;
  discountPrice?: number;
  discountRate?: number;
  limitedFlag?: number;
  booksGenreId?: string;
}

function mapCommon(r: CommonRawFields): CommonFields {
  return {
    title: r.title ?? "",
    titleKana: r.titleKana,
    itemPrice: r.itemPrice ?? 0,
    itemUrl: r.itemUrl ?? "",
    itemCaption: r.itemCaption,
    availability: r.availability ?? 0,
    postageFlag: r.postageFlag ?? 0,
    reviewCount: r.reviewCount ?? 0,
    reviewAverage: r.reviewAverage ?? 0,
    imageUrl: r.mediumImageUrl ?? r.largeImageUrl ?? r.smallImageUrl,
    salesDate: r.salesDate,
    listPrice: r.listPrice,
    discountPrice: r.discountPrice,
    discountRate: r.discountRate,
    limitedFlag: r.limitedFlag,
    booksGenreId: r.booksGenreId,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// books_total_search — Cross-category Rakuten Books search
// ──────────────────────────────────────────────────────────────────────────────

const totalSearchInput = z.object({
  keyword: z
    .string()
    .min(1)
    .describe(
      "Search keyword across all Rakuten Books categories (books, CDs, DVDs, software, games, magazines). 楽天ブックス全カテゴリ横断キーワード検索。",
    ),
  ...commonSearchFields,
});

interface RawBooksTotalItem extends CommonRawFields {
  author?: string;
  authorKana?: string;
  publisherName?: string;
  isbn?: string;
  jan?: string;
  artistName?: string;
  artistNameKana?: string;
  label?: string;
}

export interface BooksTotalItem extends CommonFields {
  author?: string;
  publisherName?: string;
  isbn?: string;
  jan?: string;
  artistName?: string;
  label?: string;
}

function mapTotal(r: RawBooksTotalItem): BooksTotalItem {
  return {
    ...mapCommon(r),
    author: r.author,
    publisherName: r.publisherName,
    isbn: r.isbn,
    jan: r.jan,
    artistName: r.artistName,
    label: r.label,
  };
}

export const booksTotalSearchTool: ToolDefinition<typeof totalSearchInput> = {
  name: "books_total_search",
  title: bilingual("Search Rakuten Books (All Categories)", "楽天ブックス全カテゴリ検索"),
  description: bilingual(
    "Cross-category search across Rakuten Books — books, CDs, DVDs, video games, software, magazines, and foreign-language books. Use this when you don't know which category contains the target item. For category-specific results with category-specific fields, use the books_book_search / books_cd_search / etc. tools.",
    "楽天ブックス(本、CD、DVD、ゲーム、ソフトウェア、雑誌、洋書)を横断検索します。カテゴリが不明な検索に使用してください。カテゴリ固有のフィールドが必要な場合は books_book_search / books_cd_search などを使用してください。",
  ),
  inputSchema: totalSearchInput,
  async handler(args, config) {
    return runBooksSearch<RawBooksTotalItem, BooksTotalItem>(
      "/services/api/BooksTotal/Search/20170404",
      buildBooksParams({ keyword: args.keyword }, args),
      mapTotal,
      config,
      args.hits,
      args.page,
    );
  },
};

/** Shared parameter builder for all Books search endpoints. */
function buildBooksParams(
  specific: Record<string, string | undefined>,
  common: { hits: number; page: number; sort: string; booksGenreId?: string },
): Record<string, string> {
  const params: Record<string, string> = {
    hits: String(common.hits),
    page: String(common.page),
    sort: common.sort,
  };
  if (common.booksGenreId) params.booksGenreId = common.booksGenreId;
  for (const [k, v] of Object.entries(specific)) {
    if (v !== undefined && v !== "") params[k] = v;
  }
  return params;
}

// ──────────────────────────────────────────────────────────────────────────────
// books_book_search — printed books
// ──────────────────────────────────────────────────────────────────────────────

const bookSearchInput = z.object({
  title: z.string().optional().describe("Book title (partial match). 書名(部分一致)。"),
  author: z.string().optional().describe("Author name. 著者名。"),
  publisherName: z.string().optional().describe("Publisher name. 出版社。"),
  isbnjan: z.string().optional().describe("ISBN or JAN code. ISBN または JAN コード。"),
  keyword: z.string().optional().describe("Free-text keyword across all fields. 全フィールド横断のキーワード。"),
  ...commonSearchFields,
}).refine(
  (v) => v.title || v.author || v.publisherName || v.isbnjan || v.keyword,
  { message: "At least one of title, author, publisherName, isbnjan, keyword is required. title/author/publisherName/isbnjan/keyword のいずれか必須。" },
);

interface RawBooksBookItem extends CommonRawFields {
  author?: string;
  authorKana?: string;
  publisherName?: string;
  isbn?: string;
  subTitle?: string;
  subTitleKana?: string;
  seriesName?: string;
  seriesNameKana?: string;
  contents?: string;
  chirayomiUrl?: string;
  size?: string;
}

export interface BooksBookItem extends CommonFields {
  author?: string;
  publisherName?: string;
  isbn?: string;
  subTitle?: string;
  seriesName?: string;
  contents?: string;
  previewUrl?: string;
  size?: string;
}

function mapBook(r: RawBooksBookItem): BooksBookItem {
  return {
    ...mapCommon(r),
    author: r.author,
    publisherName: r.publisherName,
    isbn: r.isbn,
    subTitle: r.subTitle,
    seriesName: r.seriesName,
    contents: r.contents,
    previewUrl: r.chirayomiUrl,
    size: r.size,
  };
}

export const booksBookSearchTool: ToolDefinition<typeof bookSearchInput> = {
  name: "books_book_search",
  title: bilingual("Search Rakuten Books (Printed Books)", "楽天ブックスで書籍を検索"),
  description: bilingual(
    "Search Rakuten Books for printed books by title, author, ISBN, publisher, or free-text keyword. Returns book details including ISBN, author, publisher, series, table of contents, preview URL, list price, and review stats. Pass at least one search field.",
    "楽天ブックスで紙の書籍を、書名・著者・ISBN・出版社・キーワードで検索します。ISBN、著者、出版社、シリーズ、目次、立ち読みURL、定価、レビューを含む書籍詳細を返します。検索条件は少なくとも1つ必須。",
  ),
  inputSchema: bookSearchInput,
  async handler(args, config) {
    return runBooksSearch<RawBooksBookItem, BooksBookItem>(
      "/services/api/BooksBook/Search/20170404",
      buildBooksParams(
        {
          title: args.title,
          author: args.author,
          publisherName: args.publisherName,
          isbnjan: args.isbnjan,
          keyword: args.keyword,
        },
        args,
      ),
      mapBook,
      config,
      args.hits,
      args.page,
    );
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// books_cd_search
// ──────────────────────────────────────────────────────────────────────────────

const cdSearchInput = z.object({
  title: z.string().optional().describe("Album/single title. アルバム/シングル名。"),
  artistName: z.string().optional().describe("Artist name. アーティスト名。"),
  label: z.string().optional().describe("Record label. レーベル。"),
  jan: z.string().optional().describe("JAN code. JANコード。"),
  keyword: z.string().optional().describe("Free-text keyword. キーワード。"),
  ...commonSearchFields,
}).refine(
  (v) => v.title || v.artistName || v.label || v.jan || v.keyword,
  { message: "At least one search field is required. 検索条件が少なくとも1つ必要です。" },
);

interface RawBooksCDItem extends CommonRawFields {
  artistName?: string;
  artistNameKana?: string;
  label?: string;
  jan?: string;
  makerCode?: string | number;
  playList?: string;
  size?: string;
}

export interface BooksCDItem extends CommonFields {
  artistName?: string;
  label?: string;
  jan?: string;
  makerCode?: string;
  trackList?: string;
  size?: string;
}

function mapCD(r: RawBooksCDItem): BooksCDItem {
  return {
    ...mapCommon(r),
    artistName: r.artistName,
    label: r.label,
    jan: r.jan,
    makerCode: r.makerCode !== undefined ? String(r.makerCode) : undefined,
    trackList: r.playList,
    size: r.size,
  };
}

export const booksCDSearchTool: ToolDefinition<typeof cdSearchInput> = {
  name: "books_cd_search",
  title: bilingual("Search Rakuten Books (CDs / Music)", "楽天ブックスでCDを検索"),
  description: bilingual(
    "Search Rakuten Books for music CDs by title, artist, label, or JAN code. Returns album/single details including artist, label, JAN, track list, list price, and review stats.",
    "楽天ブックスで音楽CDを、タイトル・アーティスト・レーベル・JANで検索します。アーティスト、レーベル、JAN、収録曲、定価、レビューを含む詳細を返します。",
  ),
  inputSchema: cdSearchInput,
  async handler(args, config) {
    return runBooksSearch<RawBooksCDItem, BooksCDItem>(
      "/services/api/BooksCD/Search/20170404",
      buildBooksParams(
        {
          title: args.title,
          artistName: args.artistName,
          label: args.label,
          jan: args.jan,
          keyword: args.keyword,
        },
        args,
      ),
      mapCD,
      config,
      args.hits,
      args.page,
    );
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// books_dvd_search
// ──────────────────────────────────────────────────────────────────────────────

const dvdSearchInput = z.object({
  title: z.string().optional().describe("Title (movie or show). タイトル。"),
  artistName: z.string().optional().describe("Performer/artist. 出演者/アーティスト。"),
  label: z.string().optional().describe("Label/studio. レーベル/スタジオ。"),
  jan: z.string().optional().describe("JAN code. JANコード。"),
  keyword: z.string().optional().describe("Free-text keyword. キーワード。"),
  ...commonSearchFields,
}).refine(
  (v) => v.title || v.artistName || v.label || v.jan || v.keyword,
  { message: "At least one search field is required. 検索条件が少なくとも1つ必要です。" },
);

interface RawBooksDVDItem extends CommonRawFields {
  artistName?: string;
  artistNameKana?: string;
  label?: string;
  jan?: string;
  makerCode?: string | number;
}

export interface BooksDVDItem extends CommonFields {
  artistName?: string;
  label?: string;
  jan?: string;
  makerCode?: string;
}

function mapDVD(r: RawBooksDVDItem): BooksDVDItem {
  return {
    ...mapCommon(r),
    artistName: r.artistName,
    label: r.label,
    jan: r.jan,
    makerCode: r.makerCode !== undefined ? String(r.makerCode) : undefined,
  };
}

export const booksDVDSearchTool: ToolDefinition<typeof dvdSearchInput> = {
  name: "books_dvd_search",
  title: bilingual("Search Rakuten Books (DVDs / Blu-ray)", "楽天ブックスでDVDを検索"),
  description: bilingual(
    "Search Rakuten Books for DVDs and Blu-ray discs by title, performer, label, or JAN. Returns title details with performer, label, JAN, list price, and review stats.",
    "楽天ブックスでDVD・Blu-rayを、タイトル・出演者・レーベル・JANで検索します。出演者、レーベル、JAN、定価、レビューを含む詳細を返します。",
  ),
  inputSchema: dvdSearchInput,
  async handler(args, config) {
    return runBooksSearch<RawBooksDVDItem, BooksDVDItem>(
      "/services/api/BooksDVD/Search/20170404",
      buildBooksParams(
        {
          title: args.title,
          artistName: args.artistName,
          label: args.label,
          jan: args.jan,
          keyword: args.keyword,
        },
        args,
      ),
      mapDVD,
      config,
      args.hits,
      args.page,
    );
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// books_foreign_book_search
// ──────────────────────────────────────────────────────────────────────────────

const foreignBookSearchInput = z.object({
  title: z.string().optional().describe("Title (English or other). タイトル。"),
  author: z.string().optional().describe("Author. 著者。"),
  publisherName: z.string().optional().describe("Publisher. 出版社。"),
  isbn: z.string().optional().describe("ISBN. ISBN。"),
  keyword: z.string().optional().describe("Free-text keyword. キーワード。"),
  ...commonSearchFields,
}).refine(
  (v) => v.title || v.author || v.publisherName || v.isbn || v.keyword,
  { message: "At least one search field is required. 検索条件が少なくとも1つ必要です。" },
);

interface RawBooksForeignBookItem extends CommonRawFields {
  author?: string;
  authorKana?: string;
  publisherName?: string;
  isbn?: string;
  japaneseTitle?: string;
}

export interface BooksForeignBookItem extends CommonFields {
  author?: string;
  publisherName?: string;
  isbn?: string;
  japaneseTitle?: string;
}

function mapForeignBook(r: RawBooksForeignBookItem): BooksForeignBookItem {
  return {
    ...mapCommon(r),
    author: r.author,
    publisherName: r.publisherName,
    isbn: r.isbn,
    japaneseTitle: r.japaneseTitle,
  };
}

export const booksForeignBookSearchTool: ToolDefinition<typeof foreignBookSearchInput> = {
  name: "books_foreign_book_search",
  title: bilingual("Search Rakuten Books (Foreign-Language Books)", "楽天ブックスで洋書を検索"),
  description: bilingual(
    "Search Rakuten Books for foreign-language (non-Japanese) books by title, author, ISBN, or publisher. Returns book details plus a Japanese-translated title field when available.",
    "楽天ブックスで洋書を、タイトル・著者・ISBN・出版社で検索します。書籍詳細に加え、邦題が存在する場合は japaneseTitle を返します。",
  ),
  inputSchema: foreignBookSearchInput,
  async handler(args, config) {
    return runBooksSearch<RawBooksForeignBookItem, BooksForeignBookItem>(
      "/services/api/BooksForeignBook/Search/20170404",
      buildBooksParams(
        {
          title: args.title,
          author: args.author,
          publisherName: args.publisherName,
          isbn: args.isbn,
          keyword: args.keyword,
        },
        args,
      ),
      mapForeignBook,
      config,
      args.hits,
      args.page,
    );
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// books_magazine_search
// ──────────────────────────────────────────────────────────────────────────────

const magazineSearchInput = z.object({
  title: z.string().optional().describe("Magazine title. 雑誌名。"),
  publisherName: z.string().optional().describe("Publisher. 出版社。"),
  jan: z.string().optional().describe("JAN code. JAN。"),
  keyword: z.string().optional().describe("Free-text keyword. キーワード。"),
  ...commonSearchFields,
}).refine(
  (v) => v.title || v.publisherName || v.jan || v.keyword,
  { message: "At least one search field is required. 検索条件が少なくとも1つ必要です。" },
);

interface RawBooksMagazineItem extends CommonRawFields {
  publisherName?: string;
  jan?: string;
  cycle?: string;
  chirayomiUrl?: string;
}

export interface BooksMagazineItem extends CommonFields {
  publisherName?: string;
  jan?: string;
  cycle?: string;
  previewUrl?: string;
}

function mapMagazine(r: RawBooksMagazineItem): BooksMagazineItem {
  return {
    ...mapCommon(r),
    publisherName: r.publisherName,
    jan: r.jan,
    cycle: r.cycle,
    previewUrl: r.chirayomiUrl,
  };
}

export const booksMagazineSearchTool: ToolDefinition<typeof magazineSearchInput> = {
  name: "books_magazine_search",
  title: bilingual("Search Rakuten Books (Magazines)", "楽天ブックスで雑誌を検索"),
  description: bilingual(
    "Search Rakuten Books for magazines by title, publisher, or JAN. Returns issue details including publisher, JAN, publication cycle, preview URL, and review stats.",
    "楽天ブックスで雑誌を、タイトル・出版社・JANで検索します。出版社、JAN、発行サイクル、立ち読みURL、レビューを含む詳細を返します。",
  ),
  inputSchema: magazineSearchInput,
  async handler(args, config) {
    return runBooksSearch<RawBooksMagazineItem, BooksMagazineItem>(
      "/services/api/BooksMagazine/Search/20170404",
      buildBooksParams(
        {
          title: args.title,
          publisherName: args.publisherName,
          jan: args.jan,
          keyword: args.keyword,
        },
        args,
      ),
      mapMagazine,
      config,
      args.hits,
      args.page,
    );
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// books_game_search
// ──────────────────────────────────────────────────────────────────────────────

const gameSearchInput = z.object({
  title: z.string().optional().describe("Game title. ゲームタイトル。"),
  hardware: z.string().optional().describe("Platform/hardware (e.g., 'Nintendo Switch'). ハードウェア(例: 'Nintendo Switch')。"),
  jan: z.string().optional().describe("JAN code. JAN。"),
  keyword: z.string().optional().describe("Free-text keyword. キーワード。"),
  ...commonSearchFields,
}).refine(
  (v) => v.title || v.hardware || v.jan || v.keyword,
  { message: "At least one search field is required. 検索条件が少なくとも1つ必要です。" },
);

interface RawBooksGameItem extends CommonRawFields {
  hardware?: string;
  label?: string;
  jan?: string;
  makerCode?: string | number;
}

export interface BooksGameItem extends CommonFields {
  hardware?: string;
  label?: string;
  jan?: string;
  makerCode?: string;
}

function mapGame(r: RawBooksGameItem): BooksGameItem {
  return {
    ...mapCommon(r),
    hardware: r.hardware,
    label: r.label,
    jan: r.jan,
    makerCode: r.makerCode !== undefined ? String(r.makerCode) : undefined,
  };
}

export const booksGameSearchTool: ToolDefinition<typeof gameSearchInput> = {
  name: "books_game_search",
  title: bilingual("Search Rakuten Books (Video Games)", "楽天ブックスでゲームを検索"),
  description: bilingual(
    "Search Rakuten Books for video games by title, platform/hardware (e.g., 'Nintendo Switch', 'PlayStation 5'), or JAN. Returns title details with hardware, label, JAN, list price, and review stats.",
    "楽天ブックスでビデオゲームを、タイトル・ハード(例: 'Nintendo Switch', 'PlayStation 5')・JANで検索します。ハード、レーベル、JAN、定価、レビューを含む詳細を返します。",
  ),
  inputSchema: gameSearchInput,
  async handler(args, config) {
    return runBooksSearch<RawBooksGameItem, BooksGameItem>(
      "/services/api/BooksGame/Search/20170404",
      buildBooksParams(
        {
          title: args.title,
          hardware: args.hardware,
          jan: args.jan,
          keyword: args.keyword,
        },
        args,
      ),
      mapGame,
      config,
      args.hits,
      args.page,
    );
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// books_software_search
// ──────────────────────────────────────────────────────────────────────────────

const softwareSearchInput = z.object({
  title: z.string().optional().describe("Software title. ソフトウェア名。"),
  os: z.string().optional().describe("Target OS (e.g., 'Windows', 'macOS'). 対応OS。"),
  jan: z.string().optional().describe("JAN code. JAN。"),
  keyword: z.string().optional().describe("Free-text keyword. キーワード。"),
  ...commonSearchFields,
}).refine(
  (v) => v.title || v.os || v.jan || v.keyword,
  { message: "At least one search field is required. 検索条件が少なくとも1つ必要です。" },
);

interface RawBooksSoftwareItem extends CommonRawFields {
  os?: string;
  label?: string;
  jan?: string;
  makerCode?: string | number;
}

export interface BooksSoftwareItem extends CommonFields {
  os?: string;
  label?: string;
  jan?: string;
  makerCode?: string;
}

function mapSoftware(r: RawBooksSoftwareItem): BooksSoftwareItem {
  return {
    ...mapCommon(r),
    os: r.os,
    label: r.label,
    jan: r.jan,
    makerCode: r.makerCode !== undefined ? String(r.makerCode) : undefined,
  };
}

export const booksSoftwareSearchTool: ToolDefinition<typeof softwareSearchInput> = {
  name: "books_software_search",
  title: bilingual("Search Rakuten Books (Computer Software)", "楽天ブックスでソフトウェアを検索"),
  description: bilingual(
    "Search Rakuten Books for computer software by title, target OS (e.g., 'Windows', 'macOS'), or JAN. Returns software details with target OS, label, JAN, list price, and review stats.",
    "楽天ブックスでPCソフトウェアを、タイトル・対応OS(例: 'Windows', 'macOS')・JANで検索します。対応OS、レーベル、JAN、定価、レビューを含む詳細を返します。",
  ),
  inputSchema: softwareSearchInput,
  async handler(args, config) {
    return runBooksSearch<RawBooksSoftwareItem, BooksSoftwareItem>(
      "/services/api/BooksSoftware/Search/20170404",
      buildBooksParams(
        {
          title: args.title,
          os: args.os,
          jan: args.jan,
          keyword: args.keyword,
        },
        args,
      ),
      mapSoftware,
      config,
      args.hits,
      args.page,
    );
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// books_genre_search — Browse Rakuten Books genre tree
//   Note: this endpoint kept the OLD wrapped {parent}/{child} shape unlike the
//   new Ichiba flat shape. Treated as legacy contract.
// ──────────────────────────────────────────────────────────────────────────────

const genreSearchInput = z.object({
  booksGenreId: z
    .string()
    .default("000")
    .describe(
      "Books genre ID (e.g., '000' = top, '001' = books, '004' = CD). Three-character codes are hierarchical levels. ジャンルID('000' がトップ、'001' が書籍、'004' がCD)。",
    ),
});

export interface BooksGenreNode {
  booksGenreId: string;
  booksGenreName: string;
  genreLevel: number;
}

export interface BooksGenreSearchResult {
  current: BooksGenreNode;
  parents: BooksGenreNode[];
  children: BooksGenreNode[];
}

interface RawBooksGenreNode {
  booksGenreId?: string | number;
  booksGenreName?: string;
  genreLevel?: number;
}

interface RawBooksGenreSearchResponse {
  current?: RawBooksGenreNode;
  parents?: Array<{ parent: RawBooksGenreNode }>;
  children?: Array<{ child: RawBooksGenreNode }>;
}

function mapBooksGenre(raw: RawBooksGenreNode | undefined): BooksGenreNode {
  return {
    booksGenreId: String(raw?.booksGenreId ?? ""),
    booksGenreName: raw?.booksGenreName ?? "",
    genreLevel: raw?.genreLevel ?? 0,
  };
}

export const booksGenreSearchTool: ToolDefinition<typeof genreSearchInput> = {
  name: "books_genre_search",
  title: bilingual("Browse Rakuten Books Genres", "楽天ブックスのジャンルを参照"),
  description: bilingual(
    "Browse the Rakuten Books genre (category) hierarchy. Pass '000' to list top-level genres, or a specific 3-character genre ID to fetch its parents and direct children. Useful for narrowing book searches to a specific category.",
    "楽天ブックスのジャンル(カテゴリ)階層を参照します。'000' を渡すとトップレベル、特定の3文字ジャンルIDを渡すと親ジャンルと直下の子ジャンルを取得します。検索の絞り込みに利用できます。",
  ),
  inputSchema: genreSearchInput,
  async handler(args, config) {
    const raw = await rakutenRequest<RawBooksGenreSearchResponse>(
      {
        host: HOST_OPENAPI,
        path: "/services/api/BooksGenre/Search/20121128",
        params: { booksGenreId: args.booksGenreId },
      },
      config,
    );
    return {
      current: mapBooksGenre(raw.current),
      parents: (raw.parents ?? []).map((p) => mapBooksGenre(p.parent)),
      children: (raw.children ?? []).map((c) => mapBooksGenre(c.child)),
    } satisfies BooksGenreSearchResult;
  },
};
