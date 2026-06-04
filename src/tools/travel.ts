/**
 * Travel (Rakuten Travel — hotels and ryokan) tools.
 *
 * Host: openapi.rakuten.co.jp (verified live 2026-06-04).
 * Path root: /engine/api/Travel/...
 *
 *   - SimpleHotelSearch/20170426    → search by area code
 *   - VacantHotelSearch/20170426    → search by area + date range (availability)
 *   - HotelDetailSearch/20170426    → fetch one hotel by hotelNo
 *   - GetAreaClass/20140210         → area-code hierarchy (Japan → prefecture → city → area)
 *   - KeywordHotelSearch/20170426   → free-text search
 *   - GetHotelChainList/20131024    → list hotel chains
 *   - HotelRanking/20170426         → top hotels by ranking genre
 *
 * Response shape: most search endpoints return
 *   {pagingInfo, hotels: [{hotel: [{hotelBasicInfo}, {hotelRatingInfo}, ...]}]}
 * The inner `hotel` is an array of typed info blocks. flattenHotel() walks
 * those blocks and merges them into a flat object for consumers.
 */

import { z } from "zod";
import { HOST_OPENAPI } from "../config.js";
import { rakutenRequest } from "../client.js";
import { bilingual } from "../i18n.js";
import type { ToolDefinition } from "./types.js";

// ──────────────────────────────────────────────────────────────────────────────
// Shared types & mapper
// ──────────────────────────────────────────────────────────────────────────────

interface RawHotelBasicInfo {
  hotelNo?: number;
  hotelName?: string;
  hotelKanaName?: string;
  hotelSpecial?: string;
  hotelMinCharge?: number;
  latitude?: number;
  longitude?: number;
  postalCode?: string;
  address1?: string;
  address2?: string;
  telephoneNo?: string;
  faxNo?: string;
  access?: string;
  parkingInformation?: string;
  nearestStation?: string;
  hotelImageUrl?: string;
  hotelThumbnailUrl?: string;
  roomImageUrl?: string;
  roomThumbnailUrl?: string;
  hotelMapImageUrl?: string;
  reviewCount?: number;
  reviewAverage?: number | string;
  userReview?: string;
  hotelInformationUrl?: string;
  planListUrl?: string;
  dpPlanListUrl?: string;
  reviewUrl?: string;
}

interface RawHotelRatingInfo {
  serviceAverage?: number | string;
  locationAverage?: number | string;
  roomAverage?: number | string;
  equipmentAverage?: number | string;
  bathAverage?: number | string;
  mealAverage?: number | string;
}

interface RawHotelDetailInfo {
  reserveTelephoneNo?: string;
  middleClassCode?: string;
  largeClassCode?: string;
  smallClassCode?: string;
  detailClassCode?: string;
  areaName?: string;
  hotelClassCode?: string;
  checkinTime?: string;
  checkoutTime?: string;
  lastCheckinTime?: string;
}

interface RawHotelFacilitiesInfo {
  hotelRoomNum?: number;
  roomFacilities?: { item: string[] } | string[];
  hotelFacilities?: { item: string[] } | string[];
  aboutBath?: string;
  bathType?: string;
  bathQuality?: string;
}

interface RawRoomInfo {
  roomBasicInfo?: {
    planId?: number | string;
    planName?: string;
    roomClass?: string;
    roomName?: string;
    reserveUrl?: string;
    salesformFlag?: number;
    payment?: number;
    withDinnerFlag?: number;
    dinnerSelectFlag?: number;
    withBreakfastFlag?: number;
    breakfastSelectFlag?: number;
    pointRate?: number;
  };
  dailyCharge?: {
    rakutenCharge?: number;
    total?: number;
    chargeFlag?: number;
    stayDate?: string;
  };
}

interface RawHotelBlocks {
  hotelBasicInfo?: RawHotelBasicInfo;
  hotelRatingInfo?: RawHotelRatingInfo;
  hotelDetailInfo?: RawHotelDetailInfo;
  hotelFacilitiesInfo?: RawHotelFacilitiesInfo;
  hotelPolicyInfo?: Record<string, unknown>;
  roomInfo?: RawRoomInfo[];
}

interface RawHotelWrapper {
  hotel: RawHotelBlocks[];
}

interface RawHotelsResponse {
  pagingInfo?: {
    recordCount?: number;
    pageCount?: number;
    page?: number;
    first?: number;
    last?: number;
  };
  hotels?: RawHotelWrapper[];
}

export interface RoomPlan {
  planId?: string;
  planName?: string;
  roomClass?: string;
  roomName?: string;
  reserveUrl?: string;
  withBreakfast?: boolean;
  withDinner?: boolean;
  pointRate?: number;
  pricePerNight?: number;
  totalPrice?: number;
  stayDate?: string;
}

export interface Hotel {
  hotelNo: number;
  hotelName: string;
  hotelKanaName?: string;
  hotelMinCharge?: number;
  latitude?: number;
  longitude?: number;
  postalCode?: string;
  address1?: string;
  address2?: string;
  telephoneNo?: string;
  access?: string;
  nearestStation?: string;
  parkingInformation?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  hotelInformationUrl?: string;
  reviewCount: number;
  reviewAverage: number | string;
  /** Composite per-axis ratings when present (service, location, room, etc.). */
  ratings?: {
    service?: number | string;
    location?: number | string;
    room?: number | string;
    equipment?: number | string;
    bath?: number | string;
    meal?: number | string;
  };
  details?: {
    areaName?: string;
    hotelClassCode?: string;
    checkinTime?: string;
    checkoutTime?: string;
    largeClassCode?: string;
    middleClassCode?: string;
    smallClassCode?: string;
  };
  /** Available room plans when returned (VacantHotelSearch). */
  plans?: RoomPlan[];
}

function pickArray(v: { item: string[] } | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) return v;
  return v.item;
}

/**
 * Walk the array of `hotelXxxInfo` blocks and merge them into a flat Hotel
 * for consumers. Each block is keyed by exactly one field name (Rakuten quirk).
 */
function flattenHotel(blocks: RawHotelBlocks[]): Hotel | null {
  let basic: RawHotelBasicInfo | undefined;
  let rating: RawHotelRatingInfo | undefined;
  let detail: RawHotelDetailInfo | undefined;
  const plans: RoomPlan[] = [];

  for (const blk of blocks) {
    if (blk.hotelBasicInfo) basic = blk.hotelBasicInfo;
    if (blk.hotelRatingInfo) rating = blk.hotelRatingInfo;
    if (blk.hotelDetailInfo) detail = blk.hotelDetailInfo;
    if (blk.roomInfo) {
      for (const r of blk.roomInfo) {
        const b = r.roomBasicInfo;
        if (!b) continue;
        plans.push({
          planId: b.planId !== undefined ? String(b.planId) : undefined,
          planName: b.planName,
          roomClass: b.roomClass,
          roomName: b.roomName,
          reserveUrl: b.reserveUrl,
          withBreakfast: b.withBreakfastFlag === 1 || b.breakfastSelectFlag === 1,
          withDinner: b.withDinnerFlag === 1 || b.dinnerSelectFlag === 1,
          pointRate: b.pointRate,
          pricePerNight: r.dailyCharge?.rakutenCharge,
          totalPrice: r.dailyCharge?.total,
          stayDate: r.dailyCharge?.stayDate,
        });
      }
    }
  }

  if (!basic) return null;
  const result: Hotel = {
    hotelNo: basic.hotelNo ?? 0,
    hotelName: basic.hotelName ?? "",
    hotelKanaName: basic.hotelKanaName,
    hotelMinCharge: basic.hotelMinCharge,
    latitude: basic.latitude,
    longitude: basic.longitude,
    postalCode: basic.postalCode,
    address1: basic.address1,
    address2: basic.address2,
    telephoneNo: basic.telephoneNo,
    access: basic.access,
    nearestStation: basic.nearestStation,
    parkingInformation: basic.parkingInformation,
    imageUrl: basic.hotelImageUrl,
    thumbnailUrl: basic.hotelThumbnailUrl,
    hotelInformationUrl: basic.hotelInformationUrl,
    reviewCount: basic.reviewCount ?? 0,
    reviewAverage: basic.reviewAverage ?? 0,
  };
  if (rating) {
    result.ratings = {
      service: rating.serviceAverage,
      location: rating.locationAverage,
      room: rating.roomAverage,
      equipment: rating.equipmentAverage,
      bath: rating.bathAverage,
      meal: rating.mealAverage,
    };
  }
  if (detail) {
    result.details = {
      areaName: detail.areaName,
      hotelClassCode: detail.hotelClassCode,
      checkinTime: detail.checkinTime,
      checkoutTime: detail.checkoutTime,
      largeClassCode: detail.largeClassCode,
      middleClassCode: detail.middleClassCode,
      smallClassCode: detail.smallClassCode,
    };
  }
  if (plans.length > 0) result.plans = plans;
  return result;
}

export interface PagedHotels {
  recordCount: number;
  pageCount: number;
  page: number;
  first: number;
  last: number;
  hotels: Hotel[];
}

function mapPagedHotels(raw: RawHotelsResponse, defaultPage: number): PagedHotels {
  const p = raw.pagingInfo ?? {};
  return {
    recordCount: p.recordCount ?? 0,
    pageCount: p.pageCount ?? 0,
    page: p.page ?? defaultPage,
    first: p.first ?? 0,
    last: p.last ?? 0,
    hotels: (raw.hotels ?? [])
      .map((w) => flattenHotel(w.hotel))
      .filter((h): h is Hotel => h !== null),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// travel_simple_hotel_search
// ──────────────────────────────────────────────────────────────────────────────

const simpleHotelSearchInput = z.object({
  largeClassCode: z.string().optional().describe(
    "Large area class (e.g., 'japan'). Use travel_get_area_class to discover. 大エリア(例: 'japan')。",
  ),
  middleClassCode: z.string().optional().describe("Prefecture-level code (e.g., 'tokyo'). 都道府県。"),
  smallClassCode: z.string().optional().describe("City-level code (e.g., 'tokyo'). 市区町村。"),
  detailClassCode: z.string().optional().describe("District-level code (e.g., 'A'). 詳細エリア。"),
  latitude: z.number().optional().describe("Latitude (decimal degrees) for coordinate search. 緯度。"),
  longitude: z.number().optional().describe("Longitude (decimal degrees) for coordinate search. 経度。"),
  searchRadius: z.number().min(0.1).max(3.0).optional().describe(
    "Search radius in kilometers (0.1–3.0) when using lat/lon. 検索半径(km、0.1〜3.0)。",
  ),
  hits: z.number().int().min(1).max(30).default(10).describe("Results per page (1–30). 取得件数。"),
  page: z.number().int().min(1).max(100).default(1).describe("Page number. ページ番号。"),
}).refine(
  (v) =>
    Boolean(v.largeClassCode) ||
    (v.latitude !== undefined && v.longitude !== undefined),
  { message: "Either largeClassCode (+ optional sub-classes) or both latitude AND longitude must be provided. largeClassCode か (latitude AND longitude) のいずれかが必要です。" },
);

export const travelSimpleHotelSearchTool: ToolDefinition<typeof simpleHotelSearchInput> = {
  name: "travel_simple_hotel_search",
  title: bilingual("Search Rakuten Travel Hotels (by Area)", "楽天トラベルでホテル検索(エリア指定)"),
  description: bilingual(
    "Search Rakuten Travel hotels by area code (japan → prefecture → city → district) or by latitude/longitude coordinates. Returns hotel summaries with prices, addresses, review stats, and ratings. Use travel_get_area_class to discover area codes.",
    "楽天トラベルのホテルをエリアコード階層(日本→都道府県→市区町村→詳細)、または緯度経度で検索します。価格、住所、レビュー、評価を含むホテル一覧を返します。エリアコードは travel_get_area_class で取得できます。",
  ),
  inputSchema: simpleHotelSearchInput,
  async handler(args, config) {
    const params: Record<string, string> = {
      hits: String(args.hits),
      page: String(args.page),
    };
    if (args.largeClassCode) params.largeClassCode = args.largeClassCode;
    if (args.middleClassCode) params.middleClassCode = args.middleClassCode;
    if (args.smallClassCode) params.smallClassCode = args.smallClassCode;
    if (args.detailClassCode) params.detailClassCode = args.detailClassCode;
    if (args.latitude !== undefined) params.latitude = String(args.latitude);
    if (args.longitude !== undefined) params.longitude = String(args.longitude);
    if (args.searchRadius !== undefined) params.searchRadius = String(args.searchRadius);

    const raw = await rakutenRequest<RawHotelsResponse>(
      { host: HOST_OPENAPI, path: "/engine/api/Travel/SimpleHotelSearch/20170426", params },
      config,
    );
    return mapPagedHotels(raw, args.page);
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// travel_vacant_hotel_search — availability search
// ──────────────────────────────────────────────────────────────────────────────

const vacantHotelSearchInput = z.object({
  checkinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD").describe("Check-in date (YYYY-MM-DD). チェックイン日(YYYY-MM-DD)。"),
  checkoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD").describe("Check-out date (YYYY-MM-DD). チェックアウト日(YYYY-MM-DD)。"),
  adultNum: z.number().int().min(1).max(99).default(1).describe("Number of adult guests. 大人人数。"),
  roomNum: z.number().int().min(1).max(99).default(1).describe("Number of rooms. 部屋数。"),
  largeClassCode: z.string().optional().describe("Large area class. 大エリア。"),
  middleClassCode: z.string().optional().describe("Prefecture code. 都道府県。"),
  smallClassCode: z.string().optional().describe("City code. 市区町村。"),
  detailClassCode: z.string().optional().describe("District code. 詳細エリア。"),
  latitude: z.number().optional().describe("Latitude. 緯度。"),
  longitude: z.number().optional().describe("Longitude. 経度。"),
  searchRadius: z.number().min(0.1).max(3.0).optional().describe("Search radius km. 検索半径(km)。"),
  hits: z.number().int().min(1).max(30).default(10).describe("Results per page. 取得件数。"),
  page: z.number().int().min(1).max(100).default(1).describe("Page number. ページ番号。"),
}).refine(
  (v) =>
    Boolean(v.largeClassCode) ||
    (v.latitude !== undefined && v.longitude !== undefined),
  { message: "Either largeClassCode or both latitude AND longitude required. largeClassCode か (latitude AND longitude) のいずれかが必要です。" },
);

export const travelVacantHotelSearchTool: ToolDefinition<typeof vacantHotelSearchInput> = {
  name: "travel_vacant_hotel_search",
  title: bilingual("Search Rakuten Travel Hotels (Available on Dates)", "楽天トラベルで空室検索"),
  description: bilingual(
    "Search Rakuten Travel for hotels with rooms available on specific check-in/check-out dates. Returns each hotel together with its available room plans (plan name, price per night, total price, with-breakfast flag, reserve URL). Same area-code or lat/lon parameters as travel_simple_hotel_search.",
    "指定のチェックイン/チェックアウト日に空室がある楽天トラベルのホテルを検索します。各ホテルと利用可能なプラン(プラン名、1泊あたりの価格、合計金額、朝食有無、予約URL)を返します。エリア/座標パラメータは travel_simple_hotel_search と同じ。",
  ),
  inputSchema: vacantHotelSearchInput,
  async handler(args, config) {
    const params: Record<string, string> = {
      checkinDate: args.checkinDate,
      checkoutDate: args.checkoutDate,
      adultNum: String(args.adultNum),
      roomNum: String(args.roomNum),
      hits: String(args.hits),
      page: String(args.page),
    };
    if (args.largeClassCode) params.largeClassCode = args.largeClassCode;
    if (args.middleClassCode) params.middleClassCode = args.middleClassCode;
    if (args.smallClassCode) params.smallClassCode = args.smallClassCode;
    if (args.detailClassCode) params.detailClassCode = args.detailClassCode;
    if (args.latitude !== undefined) params.latitude = String(args.latitude);
    if (args.longitude !== undefined) params.longitude = String(args.longitude);
    if (args.searchRadius !== undefined) params.searchRadius = String(args.searchRadius);

    const raw = await rakutenRequest<RawHotelsResponse>(
      { host: HOST_OPENAPI, path: "/engine/api/Travel/VacantHotelSearch/20170426", params },
      config,
    );
    return mapPagedHotels(raw, args.page);
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// travel_hotel_detail_search
// ──────────────────────────────────────────────────────────────────────────────

const hotelDetailSearchInput = z.object({
  hotelNo: z.number().int().positive().describe("Hotel number (from search results). ホテル番号(検索結果から取得)。"),
});

export const travelHotelDetailSearchTool: ToolDefinition<typeof hotelDetailSearchInput> = {
  name: "travel_hotel_detail_search",
  title: bilingual("Get Rakuten Travel Hotel Details", "楽天トラベルのホテル詳細を取得"),
  description: bilingual(
    "Fetch detailed information for a specific Rakuten Travel hotel by its hotelNo. Returns the same Hotel shape as search endpoints but with the per-axis ratings and detail fields populated.",
    "特定の楽天トラベルホテルの詳細情報を hotelNo で取得します。検索系と同じ Hotel 形式で、評価軸(サービス/立地/部屋など)や詳細情報も含めて返します。",
  ),
  inputSchema: hotelDetailSearchInput,
  async handler(args, config) {
    const raw = await rakutenRequest<RawHotelsResponse>(
      {
        host: HOST_OPENAPI,
        path: "/engine/api/Travel/HotelDetailSearch/20170426",
        params: { hotelNo: String(args.hotelNo) },
      },
      config,
    );
    const result = mapPagedHotels(raw, 1);
    return result.hotels[0] ?? null;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// travel_get_area_class — area-code hierarchy
// ──────────────────────────────────────────────────────────────────────────────

const getAreaClassInput = z.object({});

interface RawAreaTree {
  areaClasses?: {
    largeClasses?: Array<{ largeClass: RawLargeClass }>;
  };
}
interface RawLargeClass {
  largeClassCode?: string;
  largeClassName?: string;
  middleClasses?: Array<{ middleClass: RawMiddleClass }>;
}
interface RawMiddleClass {
  middleClassCode?: string;
  middleClassName?: string;
  smallClasses?: Array<{ smallClass: RawSmallClass }>;
}
interface RawSmallClass {
  smallClassCode?: string;
  smallClassName?: string;
  detailClasses?: Array<{ detailClass: RawDetailClass }>;
}
interface RawDetailClass {
  detailClassCode?: string;
  detailClassName?: string;
}

export interface AreaDetail {
  code: string;
  name: string;
}
export interface AreaSmall {
  code: string;
  name: string;
  details?: AreaDetail[];
}
export interface AreaMiddle {
  code: string;
  name: string;
  smalls?: AreaSmall[];
}
export interface AreaLarge {
  code: string;
  name: string;
  middles?: AreaMiddle[];
}
export interface AreaTreeResult {
  larges: AreaLarge[];
}

export const travelGetAreaClassTool: ToolDefinition<typeof getAreaClassInput> = {
  name: "travel_get_area_class",
  title: bilingual("Get Rakuten Travel Area Classification", "楽天トラベルのエリア区分を取得"),
  description: bilingual(
    "Get the full Rakuten Travel area-code hierarchy: Japan → prefecture (middle) → city (small) → district (detail). Use the returned codes as largeClassCode/middleClassCode/etc. in the hotel search tools.",
    "楽天トラベルのエリアコード階層を取得します(日本→都道府県→市区町村→詳細)。返されたコードを largeClassCode/middleClassCode 等としてホテル検索ツールに渡してください。",
  ),
  inputSchema: getAreaClassInput,
  async handler(_args, config) {
    const raw = await rakutenRequest<RawAreaTree>(
      { host: HOST_OPENAPI, path: "/engine/api/Travel/GetAreaClass/20140210", params: {} },
      config,
    );
    const larges: AreaLarge[] = (raw.areaClasses?.largeClasses ?? []).map((wL) => {
      const L = wL.largeClass;
      return {
        code: L.largeClassCode ?? "",
        name: L.largeClassName ?? "",
        middles: (L.middleClasses ?? []).map((wM) => {
          const M = wM.middleClass;
          return {
            code: M.middleClassCode ?? "",
            name: M.middleClassName ?? "",
            smalls: (M.smallClasses ?? []).map((wS) => {
              const S = wS.smallClass;
              return {
                code: S.smallClassCode ?? "",
                name: S.smallClassName ?? "",
                details: (S.detailClasses ?? []).map((wD) => ({
                  code: wD.detailClass.detailClassCode ?? "",
                  name: wD.detailClass.detailClassName ?? "",
                })),
              };
            }),
          };
        }),
      };
    });
    return { larges } satisfies AreaTreeResult;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// travel_keyword_hotel_search
// ──────────────────────────────────────────────────────────────────────────────

const keywordHotelSearchInput = z.object({
  keyword: z.string().min(2).describe("Free-text keyword (min 2 characters). フリーキーワード(2文字以上)。"),
  hits: z.number().int().min(1).max(30).default(10).describe("Results per page. 取得件数。"),
  page: z.number().int().min(1).max(100).default(1).describe("Page number. ページ番号。"),
});

export const travelKeywordHotelSearchTool: ToolDefinition<typeof keywordHotelSearchInput> = {
  name: "travel_keyword_hotel_search",
  title: bilingual("Search Rakuten Travel Hotels (by Keyword)", "楽天トラベルでホテルをキーワード検索"),
  description: bilingual(
    "Search Rakuten Travel hotels by free-text keyword (hotel name, area name, landmark). Returns the same Hotel shape as travel_simple_hotel_search. Useful when you don't know the area code.",
    "楽天トラベルのホテルをフリーキーワード(ホテル名、エリア名、ランドマーク)で検索します。エリアコードが分からないときに有用です。",
  ),
  inputSchema: keywordHotelSearchInput,
  async handler(args, config) {
    const raw = await rakutenRequest<RawHotelsResponse>(
      {
        host: HOST_OPENAPI,
        path: "/engine/api/Travel/KeywordHotelSearch/20170426",
        params: { keyword: args.keyword, hits: String(args.hits), page: String(args.page) },
      },
      config,
    );
    return mapPagedHotels(raw, args.page);
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// travel_get_hotel_chain_list
// ──────────────────────────────────────────────────────────────────────────────

const getHotelChainListInput = z.object({});

interface RawHotelChain {
  hotelChainCode?: string;
  hotelChainName?: string;
  hotelChainNameKana?: string;
  hotelChainComment?: string;
}

interface RawHotelChainBlock {
  largeClassCode?: string;
  hotelChains?: Array<{ hotelChain: RawHotelChain }>;
}

interface RawHotelChainListResponse {
  largeClasses?: Array<{ largeClass: RawHotelChainBlock[] }>;
}

export interface HotelChain {
  code: string;
  name: string;
  nameKana?: string;
  comment?: string;
  /** e.g. "japan" or "international". */
  largeClassCode?: string;
}

export interface HotelChainListResult {
  chains: HotelChain[];
}

export const travelGetHotelChainListTool: ToolDefinition<typeof getHotelChainListInput> = {
  name: "travel_get_hotel_chain_list",
  title: bilingual("Get Rakuten Travel Hotel Chains", "楽天トラベルのホテルチェーン一覧"),
  description: bilingual(
    "List all Rakuten Travel hotel chains (Marriott, APA, Hilton, Toyoko Inn, etc.) with their codes. Useful for filtering or grouping search results by chain.",
    "楽天トラベルに登録されている全ホテルチェーン(マリオット、APA、ヒルトン、東横INN等)とコードを返します。",
  ),
  inputSchema: getHotelChainListInput,
  async handler(_args, config) {
    const raw = await rakutenRequest<RawHotelChainListResponse>(
      { host: HOST_OPENAPI, path: "/engine/api/Travel/GetHotelChainList/20131024", params: {} },
      config,
    );
    const chains: HotelChain[] = [];
    for (const wL of raw.largeClasses ?? []) {
      for (const blk of wL.largeClass ?? []) {
        for (const wC of blk.hotelChains ?? []) {
          const c = wC.hotelChain;
          chains.push({
            code: c.hotelChainCode ?? "",
            name: c.hotelChainName ?? "",
            nameKana: c.hotelChainNameKana,
            comment: c.hotelChainComment || undefined,
            largeClassCode: blk.largeClassCode,
          });
        }
      }
    }
    return { chains } satisfies HotelChainListResult;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// travel_hotel_ranking
// ──────────────────────────────────────────────────────────────────────────────

const TRAVEL_RANKING_GENRES = [
  "all",
  "onsen",
  "ryokan",
  "city",
  "resort",
  "businesshotel",
  "pension",
  "publichouse",
] as const;

const hotelRankingInput = z.object({
  genre: z
    .enum(TRAVEL_RANKING_GENRES)
    .default("all")
    .describe(
      "Ranking genre. 'all' is overall; others narrow by hotel type. ランキング種別。'all' は総合、他はタイプ別。",
    ),
});

interface RawRankedHotel {
  rank?: number;
  hotelNo?: number;
  hotelName?: string;
  hotelInformationUrl?: string;
  planListUrl?: string;
  hotelImageUrl?: string;
  hotelThumbnailUrl?: string;
  middleClassName?: string;
  reviewCount?: number;
  reviewAverage?: number | string;
  userReview?: string;
  reviewUrl?: string;
  checkAvailableUrl?: string;
}

interface RawHotelRankingResponse {
  Rankings?: Array<{
    Ranking: {
      genre?: string;
      title?: string;
      lastBuildDate?: string;
      hotels?: Array<{ hotel: RawRankedHotel }>;
    };
  }>;
}

export interface RankedHotel {
  rank: number;
  hotelNo: number;
  hotelName: string;
  hotelInformationUrl?: string;
  planListUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  area?: string;
  reviewCount: number;
  reviewAverage: number | string;
}

export interface HotelRankingResult {
  genre: string;
  title: string;
  lastBuildDate: string;
  hotels: RankedHotel[];
}

export const travelHotelRankingTool: ToolDefinition<typeof hotelRankingInput> = {
  name: "travel_hotel_ranking",
  title: bilingual("Get Rakuten Travel Hotel Ranking", "楽天トラベルのホテルランキング"),
  description: bilingual(
    "Get the top-ranked hotels on Rakuten Travel, overall or by ranking genre (onsen, ryokan, city, resort, businesshotel, pension, publichouse). Returns ranked hotels with rank, name, area, review stats, and information URLs.",
    "楽天トラベルのホテルランキングを取得します。'all'(総合)、または温泉/旅館/シティ/リゾート/ビジネス/ペンション/公共の宿でタイプ別に絞り込めます。順位、ホテル名、エリア、レビュー、URLを返します。",
  ),
  inputSchema: hotelRankingInput,
  async handler(args, config) {
    const raw = await rakutenRequest<RawHotelRankingResponse>(
      {
        host: HOST_OPENAPI,
        path: "/engine/api/Travel/HotelRanking/20170426",
        params: { genre: args.genre },
      },
      config,
    );
    const block = raw.Rankings?.[0]?.Ranking;
    return {
      genre: block?.genre ?? args.genre,
      title: block?.title ?? "",
      lastBuildDate: block?.lastBuildDate ?? "",
      hotels: (block?.hotels ?? []).map((w) => {
        const h = w.hotel;
        return {
          rank: h.rank ?? 0,
          hotelNo: h.hotelNo ?? 0,
          hotelName: h.hotelName ?? "",
          hotelInformationUrl: h.hotelInformationUrl,
          planListUrl: h.planListUrl,
          imageUrl: h.hotelImageUrl,
          thumbnailUrl: h.hotelThumbnailUrl,
          area: h.middleClassName,
          reviewCount: h.reviewCount ?? 0,
          reviewAverage: h.reviewAverage ?? 0,
        };
      }),
    } satisfies HotelRankingResult;
  },
};
